import { useCallback, useEffect, useState } from "react";

import { moveBoardWithinTopic } from "./operations";
import { loadBoards, SAMPLE_BOARDS, saveBoards } from "./storage";
import type { Board } from "./types";

const SAVE_DEBOUNCE_MS = 300;

export type BoardsStore = {
  boards: Board[];
  /** Commit a finished board to the front of the list (a new board from the editor). */
  addBoard: (board: Board) => void;
  deleteBoard: (id: string) => void;
  /** Apply a pure update to one board; its id is preserved and `updatedAt` is refreshed. */
  updateBoard: (id: string, update: (board: Board) => Board) => void;
  /** Reorder a board among its topic's boards. Structural, so it leaves `updatedAt` untouched. */
  moveBoardInTopic: (topicId: string, boardId: string, dir: -1 | 1) => void;
  /** Return the given boards to Unfiled (e.g. removed from a topic, or their topic was deleted). */
  unfileBoards: (boardIds: readonly string[]) => void;
};

/** The board collection, seeded on first run and persisted to localStorage after edits settle. */
export function useBoards(): BoardsStore {
  const [boards, setBoards] = useState<Board[]>(() => loadBoards() ?? SAMPLE_BOARDS);

  // Persist once edits settle, so a burst of changes writes once, not per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => saveBoards(boards), SAVE_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [boards]);

  const addBoard = useCallback((board: Board) => {
    setBoards((prev) => [board, ...prev]);
  }, []);

  const deleteBoard = useCallback((id: string) => {
    setBoards((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const updateBoard = useCallback((id: string, fn: (board: Board) => Board) => {
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...fn(b), id: b.id, updatedAt: Date.now() } : b)));
  }, []);

  const moveBoardInTopic = useCallback((topicId: string, boardId: string, dir: -1 | 1) => {
    setBoards((prev) => moveBoardWithinTopic(prev, topicId, boardId, dir));
  }, []);

  const unfileBoards = useCallback((boardIds: readonly string[]) => {
    const ids = new Set(boardIds);

    setBoards((prev) => prev.map((b) => (ids.has(b.id) ? { ...b, topicId: null } : b)));
  }, []);

  return { boards, addBoard, deleteBoard, updateBoard, moveBoardInTopic, unfileBoards };
}
