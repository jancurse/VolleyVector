import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../auth/useAuth";
import { supabase } from "../supabase/client";
import { writeWithRetries } from "../supabase/retry";
import type { BoardRow } from "../supabase/rows";
import { boardFromRow, boardToInsert, boardToUpdate } from "../supabase/rows";
import type { Space } from "../workspace/space";
import type { Board } from "./types";

export type BoardsStore = {
  boards: Board[];
  /** True until the active space's boards have loaded. */
  loading: boolean;
  /** The last load or write error, or null. */
  error: string | null;
  /** Commit a new board (the editor's Done): awaited and retried, the list updates only on success.
   *  Resolves to null on success, or the error message — the caller owns the failure UI. */
  addBoard: (board: Board) => Promise<string | null>;
  deleteBoard: (id: string) => void;
  /** Commit an edited board, refreshing `updatedAt`. Awaited and retried like `addBoard`. */
  updateBoard: (board: Board) => Promise<string | null>;
  /** Return the given boards to Unfiled (e.g. removed from a topic, or their topic was deleted). */
  unfileBoards: (boardIds: readonly string[]) => void;
  /** Set or clear a team board's author lock. Only its author or an admin may do this (RLS-enforced). */
  setBoardLock: (id: string, locked: boolean) => void;
  /** Share a personal board into a team: visible to its members and link-resolvable. Owner-only (RLS). */
  shareBoard: (id: string, teamId: string) => void;
  /** Stop sharing a personal board, so only its owner can see it again. Owner-only (RLS). */
  unshareBoard: (id: string) => void;
  /** Move the owner's shared personal board into a team they coach; it leaves the personal space. */
  moveBoardToTeam: (id: string, teamId: string) => void;
};

/** A read query for the boards of one space: a team's by team, the personal space's by owner. Grace-archived
 *  rows (deleted_at set) are hidden from every normal view; only admin recovery reads them. */
function selectSpaceBoards(space: Space, userId: string) {
  const query = supabase.from("boards").select("*").is("deleted_at", null);

  return space.kind === "team"
    ? query.eq("scope", "team").eq("team_id", space.teamId)
    : query.eq("scope", "personal").eq("owner", userId);
}

/** The active space's boards, loaded from Supabase and written through on each edit. The editor's
 *  commits (`addBoard`/`updateBoard`) are awaited with retries and update the list only on success, so
 *  a failed Done keeps the user's draft as the sole copy of their work. The small writes apply
 *  optimistically so the UI stays responsive; one failing surfaces an error and refetches to
 *  reconcile. Access (who may read or write) is enforced by row-level security, never here. */
export function useBoards(space: Space | null): BoardsStore {
  const { user } = useAuth();

  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!space || !user) return;

    const { data, error: queryError } = await selectSpaceBoards(space, user.id);

    if (!queryError && data)
      setBoards((data as BoardRow[]).map(boardFromRow).sort((a, b) => b.updatedAt - a.updatedAt));
  }, [space, user]);

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

      setBoards((data as BoardRow[]).map(boardFromRow).sort((a, b) => b.updatedAt - a.updatedAt));
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [space, user]);

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

      const scope = space.kind === "team" ? "team" : "personal";
      const teamId = space.kind === "team" ? space.teamId : null;
      // Stamp the commit time (the server stamps its own on insert), so the board leads the
      // newest-first order even when it carries an older board's timestamps (a duplicate).
      const stamped = { ...board, createdAt: Date.now(), updatedAt: Date.now() };

      const writeError = await writeWithRetries(async () => {
        const result = await supabase.from("boards").insert(boardToInsert(stamped, user.id, scope, teamId));

        // The id is a client-minted UUID, so a duplicate key can only be this board's own earlier
        // attempt whose response was lost in transit — the save already happened, count it a success.
        return result.error?.code === "23505" ? { error: null } : result;
      });

      if (writeError === null) setBoards((prev) => [stamped, ...prev]);

      return writeError;
    },
    [space, user]
  );

  const updateBoard = useCallback(async (board: Board): Promise<string | null> => {
    const updated = { ...board, updatedAt: Date.now() };
    const writeError = await writeWithRetries(() =>
      supabase.from("boards").update(boardToUpdate(updated)).eq("id", board.id)
    );

    // Re-add a board the list no longer holds (e.g. a refetch raced the commit), so a saved board
    // never vanishes from the UI.
    if (writeError === null)
      setBoards((prev) =>
        prev.some((b) => b.id === board.id) ? prev.map((b) => (b.id === board.id ? updated : b)) : [updated, ...prev]
      );

    return writeError;
  }, []);

  // Deletion is a grace-archive, not a hard delete: the row stays for 3 months of admin recovery, hidden
  // from every normal view. The optimistic removal from the in-memory list is unchanged.
  const deleteBoard = useCallback(
    (id: string) => {
      if (!user) return;

      setBoards((prev) => prev.filter((b) => b.id !== id));
      void supabase
        .from("boards")
        .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
        .eq("id", id)
        .then(({ error: writeError }) => writeError && fail(writeError.message));
    },
    [user, fail]
  );

  const unfileBoards = useCallback(
    (boardIds: readonly string[]) => {
      if (boardIds.length === 0) return;

      const ids = new Set(boardIds);

      setBoards((prev) => prev.map((b) => (ids.has(b.id) ? { ...b, topicId: null } : b)));
      void supabase
        .from("boards")
        .update({ topic_id: null })
        .in("id", [...boardIds])
        .then(({ error: writeError }) => writeError && fail(writeError.message));
    },
    [fail]
  );

  const setBoardLock = useCallback(
    (id: string, locked: boolean) => {
      setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, authorLocked: locked } : b)));
      void supabase
        .from("boards")
        .update({ author_locked: locked })
        .eq("id", id)
        .then(({ error: writeError }) => writeError && fail(writeError.message));
    },
    [fail]
  );

  const shareBoard = useCallback(
    (id: string, teamId: string) => {
      setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, shared: true, teamId } : b)));
      void supabase
        .from("boards")
        .update({ shared: true, team_id: teamId })
        .eq("id", id)
        .then(({ error: writeError }) => writeError && fail(writeError.message));
    },
    [fail]
  );

  const unshareBoard = useCallback(
    (id: string) => {
      setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, shared: false, teamId: null } : b)));
      void supabase
        .from("boards")
        .update({ shared: false, team_id: null })
        .eq("id", id)
        .then(({ error: writeError }) => writeError && fail(writeError.message));
    },
    [fail]
  );

  // A move relocates the board into the team library, so it leaves the personal space the list holds.
  // The owner stays the author; topic_id is dropped because it referenced a personal topic.
  const moveBoardToTeam = useCallback(
    (id: string, teamId: string) => {
      setBoards((prev) => prev.filter((b) => b.id !== id));
      void supabase
        .from("boards")
        .update({ scope: "team", team_id: teamId, shared: false, topic_id: null })
        .eq("id", id)
        .then(({ error: writeError }) => writeError && fail(writeError.message));
    },
    [fail]
  );

  return {
    boards,
    loading,
    error,
    addBoard,
    deleteBoard,
    updateBoard,
    unfileBoards,
    setBoardLock,
    shareBoard,
    unshareBoard,
    moveBoardToTeam,
  };
}
