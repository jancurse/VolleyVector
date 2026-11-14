import { useEffect, useState } from "react";
import type { JSX } from "react";

import type { Game, RosterPlayer } from "../games/types";
import { CALLOUT_WARN, MUTED } from "../ui/styles";
import { versus } from "../games/format";
import { renameClashes, renamePlayers, rosterSpellingsOf, setPlayerNames, withGameMeta } from "./gameSets";
import { toReportSet } from "./reportSet";
import { loadGameSets } from "./sets";
import { StatsPage } from "./StatsPage";
import type { StatsTab } from "./StatsPage";
import type { AppData, ReportSet } from "./types";

type GameStatsProps = {
  gameIds: readonly string[];
  games: readonly Game[];
  teamName: string;
  roster: readonly RosterPlayer[];
  tab: StatsTab;
  onTab: (tab: StatsTab) => void;
  /** Shown as a game page's tab, which carries the title. */
  embedded?: boolean;
};

/**
 * The stats page over some games' saved stats, loaded from the server: a set shows only once its stats are saved,
 * with its game's teams and date and the roster's spelling of its players. Sets with only a typed-in score are
 * left out. Mount it keyed by the game ids.
 */
export function GameStats({ gameIds, games, teamName, roster, tab, onTab, embedded }: GameStatsProps): JSX.Element {
  const [loaded, setLoaded] = useState<{ sets: { gameId: string; data: AppData }[]; error: string | null } | null>(
    null
  );
  const key = gameIds.join(",");

  useEffect(() => {
    let active = true;

    void loadGameSets(key.split(",")).then(
      ({ sets, error }) => active && setLoaded({ sets: sets.filter((s) => s.data.events.length > 0), error })
    );

    return () => {
      active = false;
    };
  }, [key]);

  if (!loaded) return <p className={MUTED}>Loading the sets…</p>;
  if (loaded.error) return <p className={CALLOUT_WARN}>Couldn’t load the sets: {loaded.error}</p>;
  if (loaded.sets.length === 0) return <p className={MUTED}>No stats saved yet.</p>;

  const sets: ReportSet[] = loaded.sets.map(({ gameId, data }) => {
    const game = games.find((g) => g.id === gameId);
    const spellings = rosterSpellingsOf(setPlayerNames(data), roster);
    const spelled = renameClashes(data, spellings).length ? data : renamePlayers(data, spellings);

    return toReportSet(game ? withGameMeta(spelled, game, teamName) : spelled);
  });

  const only = gameIds.length === 1 ? games.find((g) => g.id === gameIds[0]) : undefined;
  const title = only
    ? only.name || [teamName, versus(only.opponent, only.venue)].filter(Boolean).join(" ")
    : `${gameIds.length} games`;

  return (
    <StatsPage
      sets={sets}
      eyebrow={`${teamName}, ${sets.length} ${sets.length === 1 ? "set" : "sets"}`}
      title={title}
      initialTab={tab}
      tab={tab}
      onTab={onTab}
      embedded={embedded}
    />
  );
}
