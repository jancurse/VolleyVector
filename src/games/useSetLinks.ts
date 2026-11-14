import { useCallback, useEffect, useRef } from "react";

import { renameClashes, renamePlayers, squadNames, syncPlayers } from "../stats/gameSets";
import { updateSets } from "../stats/sets";
import type { Game, RosterPlayer } from "./types";

type Saved = { error: string | null; warning?: string };

// Keeps a team's recorded sets in line with their games (see gameSets.ts): saving a game that changes its squad
// updates its stored sets' player lists, and matching players renames them in the sets. Both reach a set's
// working copy and its saved stats. The teams and date are read from the game, so changing those writes no set.
// Updates run one at a time, in order, so the last change to a game is the one its sets end up with.
export function useSetLinks(
  games: readonly Game[],
  roster: readonly RosterPlayer[],
  save: (game: Game) => Promise<{ error: string | null }>,
  onSetsChanged: () => void
): {
  saveGame: (game: Game) => Promise<Saved>;
  /** Rename players (old name to new) in the game's sets, never merging two players of one set. */
  renameInSets: (game: Game, renames: ReadonlyMap<string, string>) => Promise<string | undefined>;
} {
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // The latest roster, so a save made right after adding players (an import) knows them.
  const players = useRef(roster);

  useEffect(() => {
    players.current = roster;
  }, [roster]);

  const update = useCallback(
    (game: Game, change: Parameters<typeof updateSets>[1], skippedNote: string) => {
      const run = queue.current.then(async () => {
        const result = await updateSets([game.id], change);

        if (result.updated) onSetsChanged();

        return result.error ?? (result.skipped ? skippedNote : undefined);
      });

      queue.current = run;

      return run;
    },
    [onSetsChanged]
  );

  const syncSets = useCallback(
    (game: Game, added: readonly string[], dropped: readonly string[]) =>
      update(
        game,
        (data) => syncPlayers(data, added, dropped),
        "Sets with changes not saved yet in this browser keep their player lists."
      ),
    [update]
  );

  const renameInSets = useCallback(
    (game: Game, renames: ReadonlyMap<string, string>) =>
      update(
        game,
        (data) =>
          renameClashes(data, renames).length
            ? { error: `Set ${data.meta.setNumber || "?"} already has one of those players, so it keeps its names.` }
            : renamePlayers(data, renames),
        "Sets with changes not saved yet in this browser keep their names until you match them again after opening them."
      ),
    [update]
  );

  const saveGame = useCallback(
    async (game: Game): Promise<Saved> => {
      const before = games.find((g) => g.id === game.id);
      const { error } = await save(game);

      if (error || !before || before.squad.join() === game.squad.join()) return { error };

      const now = squadNames(game, players.current);
      const was = squadNames(before, players.current);
      const warning = await syncSets(
        game,
        now.filter((p) => !was.includes(p)),
        was.filter((p) => !now.includes(p))
      );

      return { error: null, warning: warning && `Saved the game. ${warning}` };
    },
    [games, save, syncSets]
  );

  return { saveGame, renameInSets };
}
