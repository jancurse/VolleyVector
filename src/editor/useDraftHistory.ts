import { useCallback, useRef, useState } from "react";

import type { Board } from "../boards/types";

// Undo/redo history over the editor's whole working draft. One snapshot carries the board and the
// active step id, so undoing a step delete restores the deleted step as active; selection stays
// derived outside and simply degrades when an undo removes its target. Discrete edits record through
// `set`; continuous gestures (drags, nudges, typing bursts) stream through `replace` and collapse to
// one history entry at `commit`, so a no-op gesture leaves no entry at all.

type Snapshot = { board: Board; activeStepId: string };
type History = { past: Snapshot[]; present: Snapshot; future: Snapshot[] };

// Oldest entries drop beyond this, so a long session never grows the stacks unbounded.
const CAP = 100;

export type DraftHistory = {
  draft: Board;
  activeStepId: string;
  /** Navigate between steps. Not recorded — switching steps is not an edit. */
  setActiveStepId: (id: string) => void;
  /** A recorded edit: pushes the current snapshot to the past and clears the future. */
  set: (update: (board: Board) => Board) => void;
  /** An unrecorded mid-gesture frame. The first call remembers the pre-gesture snapshot. */
  replace: (update: (board: Board) => Board) => void;
  /** End the gesture: record the pre-gesture snapshot as one entry (no-op if nothing changed). */
  commit: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

export function useDraftHistory(board: Board): DraftHistory {
  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: { board, activeStepId: board.steps[0].id },
    future: [],
  }));
  // The snapshot a live gesture started from, recorded as one past entry when the gesture commits.
  const pending = useRef<Snapshot | null>(null);

  const setActiveStepId = useCallback((id: string) => {
    setHistory((h) => ({ ...h, present: { ...h.present, activeStepId: id } }));
  }, []);

  const set = useCallback((update: (board: Board) => Board) => {
    pending.current = null;
    setHistory((h) => {
      const next = update(h.present.board);

      if (next === h.present.board) return h;

      return {
        past: [...h.past.slice(1 - CAP), h.present],
        present: { ...h.present, board: next },
        future: [],
      };
    });
  }, []);

  const replace = useCallback((update: (board: Board) => Board) => {
    setHistory((h) => {
      pending.current ??= h.present;
      const next = update(h.present.board);

      return next === h.present.board ? h : { ...h, present: { ...h.present, board: next } };
    });
  }, []);

  const commit = useCallback(() => {
    const before = pending.current;

    pending.current = null;
    if (!before) return;

    setHistory((h) =>
      h.present.board === before.board
        ? h
        : { past: [...h.past.slice(1 - CAP), before], present: h.present, future: [] }
    );
  }, []);

  const undo = useCallback(() => {
    pending.current = null;
    setHistory((h) => {
      const previous = h.past[h.past.length - 1];

      if (!previous) return h;

      return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future] };
    });
  }, []);

  const redo = useCallback(() => {
    pending.current = null;
    setHistory((h) => {
      const [next, ...rest] = h.future;

      if (!next) return h;

      return { past: [...h.past, h.present], present: next, future: rest };
    });
  }, []);

  return {
    draft: history.present.board,
    activeStepId: history.present.activeStepId,
    setActiveStepId,
    set,
    replace,
    commit,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
