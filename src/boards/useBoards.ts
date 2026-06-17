import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../auth/useAuth";
import { supabase } from "../supabase/client";
import { writeWithRetries } from "../supabase/retry";
import type { BoardRow, Capability } from "../supabase/rows";
import { boardFromRow, boardToContent, boardToInsert } from "../supabase/rows";
import type { TeamRole } from "../workspace/useWorkspace";
import type { Space } from "../workspace/space";
import type { Board } from "./types";

/** `updateBoard` resolves to this when the commit's base revision is stale: a co-editor committed first, so
 *  the caller resolves the conflict (overwrite, save a copy, or discard) rather than clobbering them. */
export const COMMIT_CONFLICT = "\0conflict";

export type BoardsStore = {
  boards: Board[];
  /** True until the active space's boards have loaded. */
  loading: boolean;
  /** The last load or write error, or null. */
  error: string | null;
  /** Commit a new board (the editor's Done on a board not yet saved): inserts the row and the creator's
   *  owner grant. Resolves to null on success, or the error message. */
  addBoard: (board: Board) => Promise<string | null>;
  /** Remove the caller's grant on a board (their user grant in the personal space, the team's grant in a
   *  team space). The board grace-archives only once its last grant is gone. */
  deleteBoard: (id: string) => void;
  /** Commit an edited board through the conflict-checked RPC. Resolves null on success, COMMIT_CONFLICT on a
   *  stale base, or the error message. Pass `overwrite` to re-base onto the current revision and win. */
  updateBoard: (board: Board, opts?: { overwrite?: boolean }) => Promise<string | null>;
};

type LoadedBoardRow = BoardRow & { board_access: { capability: Capability }[] };

/** A read query for the boards of one space: by the space's principal on the access list (a team's grants by
 *  team, the personal space's by the user). Grace-archived rows are hidden from every normal view. */
function selectSpaceBoards(space: Space, userId: string) {
  const query = supabase
    .from("boards")
    .select("*, board_access!inner(capability, user_id, team_id)")
    .is("deleted_at", null);

  return space.kind === "team"
    ? query.eq("board_access.team_id", space.teamId)
    : query.eq("board_access.user_id", userId);
}

/** The active space's boards, loaded from Supabase by access grant and written through on each edit. Content
 *  commits (`addBoard`/`updateBoard`) go through the conflict-checked RPC; access (who may read or write) is
 *  enforced by row-level security, never here. The viewer's `capability` is derived from the space's grant
 *  and their role: an admin is owner everywhere, a coach gets the team grant's capability, anyone else a
 *  team grant reads as viewer, and a direct user grant counts as itself. */
export function useBoards(space: Space | null, isAdmin: boolean, activeRole: TeamRole | null): BoardsStore {
  const { user } = useAuth();

  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const capabilityOf = useCallback(
    (grant: Capability | undefined): Capability => {
      if (isAdmin) return "owner";
      if (!grant) return "viewer";
      if (space?.kind === "team") return activeRole === "coach" ? grant : "viewer";

      return grant;
    },
    [isAdmin, activeRole, space]
  );

  const mapRows = useCallback(
    (rows: LoadedBoardRow[]): Board[] =>
      rows
        .map((row) => boardFromRow(row, capabilityOf(row.board_access[0]?.capability)))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [capabilityOf]
  );

  const refetch = useCallback(async () => {
    if (!space || !user) return;

    const { data, error: queryError } = await selectSpaceBoards(space, user.id);

    if (!queryError && data) setBoards(mapRows(data as LoadedBoardRow[]));
  }, [space, user, mapRows]);

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!space || !user) {
        setBoards([]);
        setLoading(false);

        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: queryError } = await selectSpaceBoards(space, user.id);

      if (!active) return;

      if (queryError) {
        setError(queryError.message);
        setLoading(false);

        return;
      }

      setBoards(mapRows(data as LoadedBoardRow[]));
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [space, user, mapRows]);

  const fail = useCallback(
    (message: string) => {
      setError(message);
      void refetch();
    },
    [refetch]
  );

  const addBoard = useCallback(
    async (board: Board): Promise<string | null> => {
      if (!space || !user) return "No active space to save into.";

      // Stamp the commit time so the board leads the newest-first order even when it carries an older
      // board's timestamps (a duplicate). The server stamps its own on insert.
      const stamped = { ...board, capability: "owner" as Capability, createdAt: Date.now(), updatedAt: Date.now() };

      const boardError = await writeWithRetries(async () => {
        const result = await supabase.from("boards").insert(boardToInsert(stamped, user.id));

        // A duplicate key is this board's own earlier attempt whose response was lost — count it a success.
        return result.error?.code === "23505" ? { error: null } : result;
      });

      if (boardError !== null) return boardError;

      // The creator's first grant: the access list is empty until now, so the bootstrap insert policy lets
      // the creator add it. A team board is owned by its team (coaches manage); a personal board by the user.
      const grant = {
        board_id: stamped.id,
        user_id: space.kind === "team" ? null : user.id,
        team_id: space.kind === "team" ? space.teamId : null,
        capability: "owner" as Capability,
      };

      const grantError = await writeWithRetries(async () => {
        const result = await supabase.from("board_access").insert(grant);

        return result.error?.code === "23505" ? { error: null } : result;
      });

      // The grant write failed after the row landed: remove the orphaned row so a failed create leaves
      // nothing behind. A plain delete cannot (board deletes are admin-only), so go through the RPC.
      if (grantError !== null) {
        await supabase.rpc("delete_orphan_board", { board: stamped.id });

        return grantError;
      }

      setBoards((prev) => [stamped, ...prev]);

      return null;
    },
    [space, user]
  );

  const updateBoard = useCallback(async (board: Board, opts?: { overwrite?: boolean }): Promise<string | null> => {
    let base = board.currentRevisionId;

    if (opts?.overwrite) {
      const { data: current } = await supabase.from("boards").select("current_revision_id").eq("id", board.id).single();

      base = (current as { current_revision_id: string | null } | null)?.current_revision_id ?? null;
    }

    const { data, error: rpcError } = await supabase.rpc("commit_board", {
      board: board.id,
      content: boardToContent(board),
      base,
    });

    if (rpcError) return rpcError.message;
    if (data === null) return COMMIT_CONFLICT;

    const updated = { ...board, currentRevisionId: data as string, updatedAt: Date.now() };

    setBoards((prev) =>
      prev.some((b) => b.id === board.id) ? prev.map((b) => (b.id === board.id ? updated : b)) : [updated, ...prev]
    );

    return null;
  }, []);

  // Deletion detaches the caller's grant: their user grant in the personal space, the team's grant in a team
  // space. An after-delete trigger grace-archives the board only once its last grant is gone.
  const deleteBoard = useCallback(
    (id: string) => {
      if (!space || !user) return;

      setBoards((prev) => prev.filter((b) => b.id !== id));

      const query = supabase.from("board_access").delete().eq("board_id", id);
      const scoped = space.kind === "team" ? query.eq("team_id", space.teamId) : query.eq("user_id", user.id);

      void scoped.then(({ error: writeError }) => writeError && fail(writeError.message));
    },
    [space, user, fail]
  );

  return { boards, loading, error, addBoard, deleteBoard, updateBoard };
}
