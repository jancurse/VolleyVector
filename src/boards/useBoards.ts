import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../auth/useAuth";
import { supabase } from "../supabase/client";
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
  /** Commit a finished board to the front of the list (a new board from the editor). */
  addBoard: (board: Board) => void;
  deleteBoard: (id: string) => void;
  /** Apply a pure update to one board; its id is preserved and `updatedAt` is refreshed. */
  updateBoard: (id: string, update: (board: Board) => Board) => void;
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

/** The active space's boards, loaded from Supabase and written through on each edit. Writes apply
 *  optimistically so the UI stays responsive; a failed write surfaces an error and refetches to
 *  reconcile. Access (who may read or write) is enforced by row-level security, never here. */
export function useBoards(space: Space | null): BoardsStore {
  const { user } = useAuth();

  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Read the latest boards outside a state updater, so a write can look up its target without a stale
  // closure and without a side effect inside setState.
  const boardsRef = useRef(boards);

  useEffect(() => {
    boardsRef.current = boards;
  }, [boards]);

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
    (board: Board) => {
      if (!space || !user) return;

      const scope = space.kind === "team" ? "team" : "personal";
      const teamId = space.kind === "team" ? space.teamId : null;

      setBoards((prev) => [board, ...prev]);
      void supabase
        .from("boards")
        .insert(boardToInsert(board, user.id, scope, teamId))
        .then(({ error: writeError }) => writeError && fail(writeError.message));
    },
    [space, user, fail]
  );

  const updateBoard = useCallback(
    (id: string, update: (board: Board) => Board) => {
      const target = boardsRef.current.find((b) => b.id === id);

      if (!target) return;

      const updated = { ...update(target), id: target.id, updatedAt: Date.now() };

      setBoards((prev) => prev.map((b) => (b.id === id ? updated : b)));
      void supabase
        .from("boards")
        .update(boardToUpdate(updated))
        .eq("id", id)
        .then(({ error: writeError }) => writeError && fail(writeError.message));
    },
    [fail]
  );

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
