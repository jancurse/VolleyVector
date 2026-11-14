import { formatGameDate } from "../games/format";
import { pointReasonLabel, resultLabel, skillDef } from "./codes";
import type { ReportSet } from "./types";
import { extractYoutubeId } from "./youtube";

export const OPPONENT = "Opponent";

/** One moment a highlight can be built from: a touch of ours, or a point the opponent won untouched. */
export type HighlightAction = {
  match: string;
  /** The match's date as its set holds it (an ISO day), which orders matches. */
  date: string;
  set: string;
  videoId: string | null;
  time: number;
  player: string;
  action: string;
  outcome: string;
  /** Court zone of the touch; empty for an opponent point. */
  zone: string;
  /** Score after the rally, e.g. "12–9". */
  score: string;
  /** The rally's number within its set. */
  rally: number;
};

/** A whole rally, for describing a clip that shows one. */
export type RallySummary = {
  match: string;
  set: string;
  rally: number;
  videoId: string | null;
  start: number;
  end: number;
  won: boolean;
  touches: number;
  /** Score after the rally, e.g. "12–9". */
  score: string;
  /** What ended it, e.g. "Mira · Attack Kill" or "Opp serve error"; empty when not recorded. */
  ended: string;
};

export const FILTER_FIELDS = ["match", "set", "player", "action", "outcome", "zone"] as const;
export type FilterField = (typeof FILTER_FIELDS)[number];
export type Selection = Record<FilterField, Set<string>>;

/** A padded window of one video, covering one or more actions. */
export type Clip = {
  videoId: string | null;
  start: number;
  end: number;
  actions: HighlightAction[];
};

/** Date and teams as the file names them, skipping blanks; either team may be ours. */
export const matchLabel = ({ meta }: ReportSet): string =>
  [[meta.homeTeam, meta.awayTeam].filter(Boolean).join(" vs "), meta.date && formatGameDate(meta.date)]
    .filter(Boolean)
    .join(", ") || "Untitled match";

export function highlightActions(set: ReportSet, index = 0): HighlightAction[] {
  const base = {
    match: matchLabel(set),
    date: set.meta.date,
    set: `Set ${set.meta.setNumber || index + 1}`,
    videoId: extractYoutubeId(set.meta.youtubeUrl),
  };

  return set.rallies.flatMap((r) => {
    const score = `${r.score.us}–${r.score.them}`;
    const touches = r.touches.map((t) => ({
      ...base,
      rally: r.index,
      time: t.timestamp,
      player: t.player,
      action: skillDef(t.stat).label,
      outcome: resultLabel(t.stat, t.result),
      zone: t.zone,
      score,
    }));
    const end = r.endedBy;
    const opponentPoint =
      end?.kind === "point" && end.winner === "them"
        ? [
            {
              ...base,
              rally: r.index,
              time: end.timestamp,
              player: OPPONENT,
              action: "Point",
              outcome: pointReasonLabel("them", end.reason) || "Point",
              zone: "",
              score,
            },
          ]
        : [];

    return [...touches, ...opponentPoint];
  });
}

/** Keeps actions whose every field is in its selected set; an empty selection keeps everything. */
export const filterActions = (actions: HighlightAction[], selection: Partial<Selection>): HighlightAction[] =>
  actions.filter((a) =>
    Object.entries(selection).every(([field, values]) => !values.size || values.has(a[field as FilterField]))
  );

/** Pads each action into a time window and merges windows that overlap within one video. */
export function buildClips(actions: HighlightAction[], before: number, after: number): Clip[] {
  const order = [...actions].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.match.localeCompare(b.match) ||
      a.set.localeCompare(b.set, undefined, { numeric: true }) ||
      a.time - b.time
  );
  const clips: Clip[] = [];

  for (const action of order) {
    const start = Math.max(0, action.time - before);
    const end = action.time + after;
    const last = clips.at(-1);

    if (last && last.videoId === action.videoId && start <= last.end) {
      last.end = Math.max(last.end, end);
      last.actions.push(action);
    } else {
      clips.push({ videoId: action.videoId, start, end, actions: [action] });
    }
  }

  return clips;
}

export function highlightRallies(set: ReportSet, index = 0): RallySummary[] {
  const base = {
    match: matchLabel(set),
    set: `Set ${set.meta.setNumber || index + 1}`,
    videoId: extractYoutubeId(set.meta.youtubeUrl),
  };

  return set.rallies.flatMap((r) => {
    if (!r.winner) return [];
    const end = r.endedBy;
    const ended =
      end?.kind === "touch"
        ? `${end.player} · ${skillDef(end.stat).label} ${resultLabel(end.stat, end.result)}`
        : end?.kind === "point"
          ? pointReasonLabel(end.winner, end.reason)
          : "";

    // A rally none of our players touched (e.g. an opponent serve error) is only known by when it ended.
    return [
      {
        ...base,
        rally: r.index,
        start: r.touches.length ? r.startTime : r.endTime,
        end: r.endTime,
        won: r.winner === "us",
        touches: r.touches.length,
        score: `${r.score.us}–${r.score.them}`,
        ended,
      },
    ];
  });
}

/** Identifies the rally an action or rally summary belongs to. */
export const rallyKey = (r: { match: string; set: string; rally: number }) => `${r.match}|${r.set}|${r.rally}`;

/** A YouTube link that starts the video at `seconds`. */
export const youtubeAt = (videoId: string, seconds: number) =>
  `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&t=${Math.max(0, Math.floor(seconds))}s`;

/** No filter picked: every action. */
export const emptySelection = (): Selection =>
  Object.fromEntries(FILTER_FIELDS.map((f) => [f, new Set<string>()])) as Selection;
