import { useCallback, useEffect, useState } from "react";

import { loadDrills, SAMPLE_DRILL, saveDrills } from "./storage";
import type { Drill } from "./types";

const SAVE_DEBOUNCE_MS = 300;

export type DrillsStore = {
  drills: Drill[];
  /** Commit a finished drill to the front of the list (a new drill from the editor). */
  addDrill: (drill: Drill) => void;
  deleteDrill: (id: string) => void;
  /** Apply a pure update to one drill; its id is preserved and `updatedAt` is refreshed. */
  updateDrill: (id: string, update: (drill: Drill) => Drill) => void;
};

/** The drill collection, seeded on first run and persisted to localStorage after edits settle. */
export function useDrills(): DrillsStore {
  const [drills, setDrills] = useState<Drill[]>(() => loadDrills() ?? [SAMPLE_DRILL]);

  useEffect(() => {
    const handle = setTimeout(() => saveDrills(drills), SAVE_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [drills]);

  const addDrill = useCallback((drill: Drill) => {
    setDrills((prev) => [drill, ...prev]);
  }, []);

  const deleteDrill = useCallback((id: string) => {
    setDrills((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const updateDrill = useCallback((id: string, fn: (drill: Drill) => Drill) => {
    setDrills((prev) => prev.map((d) => (d.id === id ? { ...fn(d), id: d.id, updatedAt: Date.now() } : d)));
  }, []);

  return { drills, addDrill, deleteDrill, updateDrill };
}
