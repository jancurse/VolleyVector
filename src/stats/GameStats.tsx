import { useEffect, useState } from "react";
import type { JSX } from "react";

import type { Game } from "../games/types";
import { CALLOUT_WARN, MUTED } from "../ui/styles";
import { versus } from "../games/format";
import { toReportSet } from "./reportSet";
import { loadGameSets } from "./sets";
import { StatsPage } from "./StatsPage";
import type { StatsTab } from "./StatsPage";
import type { ReportSet } from "./types";

type GameStatsProps = {
  gameIds: readonly string[];
  games: readonly Game[];
  teamName: string;
  initialTab: StatsTab;
  onTab: (tab: StatsTab) => void;
};

/** The stats page over some games' recorded sets, loaded from the server. Mount it keyed by the game ids. */
export function GameStats({ gameIds, games, teamName, initialTab, onTab }: GameStatsProps): JSX.Element {
  const [loaded, setLoaded] = useState<{ sets: ReportSet[]; error: string | null } | null>(null);
  const key = gameIds.join(",");

  useEffect(() => {
    let active = true;

    void loadGameSets(key.split(",")).then(
      ({ sets, error }) => active && setLoaded({ sets: sets.map(toReportSet), error })
    );

    return () => {
      active = false;
    };
  }, [key]);

  if (!loaded) return <p className={MUTED}>Loading the sets…</p>;
  if (loaded.error) return <p className={CALLOUT_WARN}>Couldn’t load the sets: {loaded.error}</p>;
  if (loaded.sets.length === 0) return <p className={MUTED}>No sets recorded yet.</p>;

  const only = gameIds.length === 1 ? games.find((g) => g.id === gameIds[0]) : undefined;
  const title = only
    ? only.name || [teamName, versus(only.opponent, only.venue)].filter(Boolean).join(" ")
    : `${gameIds.length} games`;

  return (
    <StatsPage
      sets={loaded.sets}
      eyebrow={`${teamName}, ${loaded.sets.length} ${loaded.sets.length === 1 ? "set" : "sets"}`}
      title={title}
      initialTab={initialTab}
      onTab={onTab}
    />
  );
}
