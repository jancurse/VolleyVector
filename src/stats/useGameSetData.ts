import { useEffect, useState } from "react";

import { localSets } from "./gameSets";
import { loadSetData } from "./sets";
import type { SetSummary } from "./types";
import type { AppData } from "./types";

export type GameSetData = {
  /** Every set of the game: the server's copy, or this browser's where it has changes the server lacks. */
  sets: AppData[];
  /** The sets of `sets` by id. */
  byId: ReadonlyMap<string, AppData>;
};

/** The full data of a game's sets (their working copies), reloaded whenever a set is saved. */
export function useGameSetData(gameId: string, summaries: readonly SetSummary[]): GameSetData | null {
  const [data, setData] = useState<GameSetData | null>(null);
  const key = summaries.map((s) => `${s.id}@${s.version}`).join();

  useEffect(() => {
    let active = true;

    void loadSetData(gameId).then(({ sets, error }) => {
      if (!active || error) return;

      const local = localSets(gameId);
      const byId = new Map([
        ...sets.map((s): [string, AppData] => [s.id, local.get(s.id)?.data ?? s.data]),
        ...[...local]
          .filter(([id]) => !sets.some((s) => s.id === id))
          .map(([id, b]): [string, AppData] => [id, b.data]),
      ]);
      const next = { sets: [...byId.values()], byId };

      setData(next);
    });

    return () => {
      active = false;
    };
  }, [gameId, key]);

  return data;
}
