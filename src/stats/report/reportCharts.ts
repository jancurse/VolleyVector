import type { ReportSet } from "../types";
import {
  chartAttacks,
  chartAttacksPerPlayer,
  chartAttacksPie,
  chartBlocks,
  chartBlocksPie,
  chartDefense,
  chartDefensePerPlayer,
  chartDefensePie,
  chartOpponentErrors,
  chartReceive,
  chartReceivePerPlayer,
  chartReceivePie,
  chartScoresOverTime,
  chartServePerPlayer,
  chartServes,
  chartServesPie,
  chartSets,
  chartSetsByZonePerPlayer,
  chartSetsPie,
} from "./chartGenerator";
import type { CanvasChart } from "./chartGenerator";
import { getFilteredDataframes, reportStats, scoresOverTime, setLabel } from "./statsAnalyzer";

/** An action's two charts: its outcomes as a pie, and the same by court zone. */
export type ChartPair = { key: string; title: string; pie: CanvasChart | null; zones: CanvasChart | null };

export type ReportCharts = {
  pairs: ChartPair[];
  perPlayer: { key: string; title: string; chart: CanvasChart | null }[];
  scores: { label: string; chart: CanvasChart | null }[];
  opponentErrors: CanvasChart | null;
  totalOpponentErrors: number;
};

/**
 * Every chart of the report. Each set's rallies are derived on their own (sets have separate video timelines);
 * only the per-touch rows are pooled.
 */
export function reportCharts(sets: readonly ReportSet[]): ReportCharts {
  const stats = sets.flatMap((s) => reportStats(s.rallies));
  const { df, df_no_errors } = getFilteredDataframes(stats);
  const [opponentErrors, totalOpponentErrors] = chartOpponentErrors(df);

  return {
    pairs: [
      { key: "serves", title: "Serves", pie: chartServesPie(df), zones: chartServes(df_no_errors) },
      { key: "attacks", title: "Attacks", pie: chartAttacksPie(df), zones: chartAttacks(df_no_errors) },
      { key: "sets", title: "Sets", pie: chartSetsPie(df), zones: chartSets(df_no_errors) },
      { key: "receive", title: "Receive", pie: chartReceivePie(df), zones: chartReceive(df) },
      { key: "defense", title: "Defense", pie: chartDefensePie(df), zones: chartDefense(df) },
      { key: "blocks", title: "Blocks", pie: chartBlocksPie(df), zones: chartBlocks(df) },
    ],
    perPlayer: [
      { key: "attacksPerPlayer", title: "Attack outcomes per player", chart: chartAttacksPerPlayer(df) },
      { key: "servePerPlayer", title: "Serve outcomes per player", chart: chartServePerPlayer(df) },
      { key: "receivePerPlayer", title: "Receive outcomes per player", chart: chartReceivePerPlayer(df) },
      { key: "defensePerPlayer", title: "Defense outcomes per player", chart: chartDefensePerPlayer(df) },
      { key: "setsByZonePerPlayer", title: "Set zone distribution per player", chart: chartSetsByZonePerPlayer(df) },
    ],
    scores: sets.map((s, i) => ({ label: setLabel(s, i), chart: chartScoresOverTime(scoresOverTime(s.rallies)) })),
    opponentErrors,
    totalOpponentErrors,
  };
}
