import { useCallback, useEffect, useState } from "react";

import { loadTactics, SAMPLE_TACTIC, saveTactics } from "./storage";
import type { Tactic } from "./types";

const SAVE_DEBOUNCE_MS = 300;

export type TacticsStore = {
  tactics: Tactic[];
  /** Commit a finished tactic to the front of the list (a new tactic from the editor). */
  addTactic: (tactic: Tactic) => void;
  deleteTactic: (id: string) => void;
  /** Apply a pure update to one tactic; its id is preserved and `updatedAt` is refreshed. */
  updateTactic: (id: string, update: (tactic: Tactic) => Tactic) => void;
};

/** The tactic collection, seeded on first run and persisted to localStorage after edits settle. */
export function useTactics(): TacticsStore {
  const [tactics, setTactics] = useState<Tactic[]>(() => loadTactics() ?? [SAMPLE_TACTIC]);

  // Persist once edits settle, so a burst of changes writes once, not per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => saveTactics(tactics), SAVE_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [tactics]);

  const addTactic = useCallback((tactic: Tactic) => {
    setTactics((prev) => [tactic, ...prev]);
  }, []);

  const deleteTactic = useCallback((id: string) => {
    setTactics((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateTactic = useCallback((id: string, fn: (tactic: Tactic) => Tactic) => {
    setTactics((prev) => prev.map((t) => (t.id === id ? { ...fn(t), id: t.id, updatedAt: Date.now() } : t)));
  }, []);

  return { tactics, addTactic, deleteTactic, updateTactic };
}
