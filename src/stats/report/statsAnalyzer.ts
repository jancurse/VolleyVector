/** The report's data, worked out from recorded sets: per-touch rows, scores, and video links. */

import type { Rally, ReportSet } from "../types";
import { extractYoutubeId } from "../youtube";

export type Stat = {
  id?: string;
  player: string;
  stat: string;
  zone: string;
  result: string;
  timestamp: number;
  /** Optional detail, e.g. "positioning" on a defense error. */
  reason?: string;
};

export type ScoreRecord = {
  timestamp: number;
  our_score: number;
  opp_score: number;
};

export function getTeamStats(stats: Stat[]): Stat[] {
  return stats.filter((s) => s.player.toLowerCase() !== "opponent");
}

export function getOpponentStats(stats: Stat[]): Stat[] {
  return stats.filter((s) => s.player.toLowerCase() === "opponent");
}

export function getFilteredDataframes(stats: Stat[]) {
  const teamFilter = getTeamStats(stats);

  // Filter out errors for zone-based analysis
  const df_no_errors = teamFilter.filter((s) => s.zone !== "0" && !["error", "net", "out"].includes(s.result));

  return {
    df: stats,
    df_no_errors: df_no_errors,
  };
}

/**
 * Flatten rallies into the per-touch rows the charts expect. Points we won
 * that none of our touches decided are added as "opponent" rows whose stat is
 * the recorded reason (e.g. serve_error), or "unspecified".
 */
export function reportStats(rallies: Rally[]): Stat[] {
  const rows: Stat[] = [];

  for (const r of rallies) {
    for (const t of r.touches) {
      rows.push({
        id: String(t.id),
        player: t.player,
        stat: t.stat,
        zone: t.zone,
        result: t.result,
        timestamp: t.timestamp,
        reason: t.reason,
      });
    }
    if (r.winner === "us" && r.endedBy?.kind !== "touch") {
      const reason = r.endedBy?.kind === "point" ? r.endedBy.reason : undefined;

      rows.push({
        player: "opponent",
        stat: reason ?? "unspecified",
        zone: "0",
        result: "error",
        timestamp: r.endTime,
      });
    }
  }

  return rows;
}

export const OPPONENT_ERROR_LABELS: Record<string, string> = {
  serve_error: "Serve",
  attack_error: "Attack",
  fault: "Net / fault",
  other: "Other",
  unspecified: "Unspecified",
};

export function finalScore(rallies: Rally[]): [number, number] {
  const last = rallies[rallies.length - 1];

  return last ? [last.score.us, last.score.them] : [0, 0];
}

export const setLabel = (set: ReportSet, index: number): string => `Set ${set.meta.setNumber || index + 1}`;

/** Per-set final scores and sets won by each side. */
export function matchSummary(sets: ReportSet[]) {
  const scores = sets.map((s) => finalScore(s.rallies));
  const setsWon = scores.reduce<[number, number]>(
    ([us, them], [a, b]) => (a > b ? [us + 1, them] : b > a ? [us, them + 1] : [us, them]),
    [0, 0]
  );

  return { scores, setsWon };
}

export function reportTitle(sets: ReportSet[]): string {
  const meta = sets[0]?.meta;
  const teams =
    meta && (meta.homeTeam || meta.awayTeam)
      ? `${meta.homeTeam || "Unknown"} vs ${meta.awayTeam || "Unknown"}`
      : "Volleyball Stats";
  const date = meta?.date ? ` (${meta.date})` : "";
  const { scores, setsWon } = matchSummary(sets);

  if (sets.length === 1) {
    const [us, them] = scores[0]!;
    const set = meta?.setNumber ? ` - Set ${meta.setNumber}` : "";

    return `${teams}${set}${date} - Score: Us ${us} - ${them} Opponent`;
  }

  return `${teams}${date} - Sets: Us ${setsWon[0]} - ${setsWon[1]} Opponent`;
}

export function scoresOverTime(rallies: Rally[]): ScoreRecord[] {
  const finished = rallies.filter((r) => r.winner);

  if (!finished.length) return [];

  return [
    { timestamp: finished[0].startTime, our_score: 0, opp_score: 0 },
    ...finished.map((r) => ({ timestamp: r.endTime, our_score: r.score.us, opp_score: r.score.them })),
  ];
}

export type ActionLinks = { stat: string; links: string[] };

export type YoutubeLinks = {
  players: { player: string; actions: ActionLinks[] }[];
  opponentErrors: { label: string; link: string }[];
};

/** Every touch of ours, by player and action, and every opponent error, as links into the set's video. */
export function youtubeLinks(stats: Stat[], youtubeUrl: string): YoutubeLinks | null {
  const videoId = extractYoutubeId(youtubeUrl);

  if (!videoId) return null;

  const at = (t: number) => `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(t)}s`;
  const byPlayer = new Map<string, Map<string, number[]>>();

  for (const stat of getTeamStats(stats)) {
    const actions = byPlayer.get(stat.player) ?? new Map<string, number[]>();

    actions.set(stat.stat, [...(actions.get(stat.stat) ?? []), stat.timestamp]);
    byPlayer.set(stat.player, actions);
  }

  return {
    players: [...byPlayer].map(([player, actions]) => ({
      player,
      actions: [...actions]
        .map(([stat, times]) => ({
          stat,
          links: times.sort((a, b) => a - b).map(at),
        }))
        .filter((a) => a.links.length > 0),
    })),
    opponentErrors: [...getOpponentStats(stats)]
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((s) => ({ label: OPPONENT_ERROR_LABELS[s.stat] ?? s.stat, link: at(s.timestamp) })),
  };
}
