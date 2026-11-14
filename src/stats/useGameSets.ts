import { useCallback, useEffect, useState } from "react";

import { listSetSummaries } from "./sets";
import type { SetSummary } from "./types";

/** The recorded sets of the given games, as summaries (no event data), reloadable after a change. */
export function useGameSets(gameIds: readonly string[]): {
  sets: SetSummary[];
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [sets, setSets] = useState<SetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = gameIds.join(",");

  useEffect(() => {
    let active = true;

    void listSetSummaries(key ? key.split(",") : []).then((result) => {
      if (!active) return;

      // A failed load keeps the sets already shown: an empty list would read as a game with no sets.
      if (!result.error) setSets(result.sets);
      setError(result.error);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [key, attempt]);

  return { sets, loading, error, reload: useCallback(() => setAttempt((n) => n + 1), []) };
}
