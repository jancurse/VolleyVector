import { useEffect, useRef, useState } from "react";

import { localSets } from "./gameSets";
import { loadSetData } from "./sets";
import type { SetSummary } from "./types";
import type { AppData } from "./types";

export type GameSetData = {
  /** Every set of the game: the server's copy, or this browser's where it has changes the server lacks. */
  sets: AppData[];
  /** The server copies of the sets this browser has no changes to, which may be updated in place. */
  stored: AppData[];
};

/**
 * The full data of a game's sets, reloaded whenever their summaries change. `onLoad` runs with each load, so the
 * game page can bring the game and its sets in line.
 */
export function useGameSetData(
  gameId: string,
  summaries: readonly SetSummary[],
  onLoad: (data: GameSetData) => void
): GameSetData | null {
  const [data, setData] = useState<GameSetData | null>(null);
  const loaded = useRef(onLoad);
  const key = summaries.map((s) => `${s.id}@${s.updatedAt}`).join();

  useEffect(() => {
    loaded.current = onLoad;
  }, [onLoad]);

  useEffect(() => {
    let active = true;

    void loadSetData(gameId).then(({ sets, error }) => {
      if (!active || error) return;

      const local = localSets(gameId);
      const next = {
        sets: [
          ...sets.map((s) => local.get(s.id)?.data ?? s.data),
          ...[...local].filter(([id]) => !sets.some((s) => s.id === id)).map(([, b]) => b.data),
        ],
        stored: sets.filter((s) => !local.has(s.id)).map((s) => s.data),
      };

      setData(next);
      loaded.current(next);
    });

    return () => {
      active = false;
    };
  }, [gameId, key]);

  return data;
}
