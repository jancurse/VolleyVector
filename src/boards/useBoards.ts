import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../auth/useAuth";
import { supabase } from "../supabase/client";
import type { BoardRow } from "../supabase/rows";
import { boardFromRow, boardToInsert, boardToUpdate } from "../supabase/rows";
import type { Board } from "./types";

export type BoardsStore = {
  boards: Board[];
  /** True until the active team's boards have loaded. */
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
};

/** The active team's boards, loaded from Supabase and written through on each edit. Writes apply
 *  optimistically so the UI stays responsive; a failed write surfaces an error and refetches to
 *  reconcile. Access (who may read or write) is enforced by row-level security, never here. */
export function useBoards(teamId: string | null): BoardsStore {
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
    if (!teamId) return;

    const { data, error: queryError } = await supabase
      .from("boards")
      .select("*")
      .eq("scope", "team")
      .eq("team_id", teamId);

    if (!queryError && data)
      setBoards((data as BoardRow[]).map(boardFromRow).sort((a, b) => b.updatedAt - a.updatedAt));
  }, [teamId]);

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!teamId) {
        setBoards([]);
        setLoading(false);

        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("boards")
        .select("*")
        .eq("scope", "team")
        .eq("team_id", teamId);

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
  }, [teamId]);

  const fail = useCallback(
    (message: string) => {
      setError(message);
      void refetch();
    },
    [refetch]
  );

  const addBoard = useCallback(
    (board: Board) => {
      if (!teamId || !user) return;

      setBoards((prev) => [board, ...prev]);
      void supabase
        .from("boards")
        .insert(boardToInsert(board, user.id, teamId))
        .then(({ error: writeError }) => writeError && fail(writeError.message));
    },
    [teamId, user, fail]
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

  const deleteBoard = useCallback(
    (id: string) => {
      setBoards((prev) => prev.filter((b) => b.id !== id));
      void supabase
        .from("boards")
        .delete()
        .eq("id", id)
        .then(({ error: writeError }) => writeError && fail(writeError.message));
    },
    [fail]
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

  return { boards, loading, error, addBoard, deleteBoard, updateBoard, unfileBoards, setBoardLock };
}
