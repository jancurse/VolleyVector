import type { Skill, Team, Touch } from "./types";

export type SkillDef = {
  id: Skill;
  label: string;
  /** Keyboard shortcut used while entering a stat. */
  key: string;
  /** What the zone means for this skill. */
  zoneHint: string;
};

export type ResultDef = {
  id: string;
  label: string;
  help: string;
  /** Team that wins the rally when this result happens, or null if play continues. */
  point: Team | null;
  /** Errors are always recorded in zone 0, so the zone step is skipped. */
  autoZone?: string;
};

export const SKILLS: SkillDef[] = [
  { id: "serve", label: "Serve", key: "s", zoneHint: "Where the serve went (0 = error)" },
  { id: "receive", label: "Receive", key: "r", zoneHint: "Where the player received from" },
  { id: "set", label: "Set", key: "e", zoneHint: "Who was set: 1 back-row, 2 opp, 3 middle, 4 outside, 5 lib, 6 pipe" },
  { id: "attack", label: "Attack", key: "a", zoneHint: "Where the attack went (0 = error)" },
  { id: "block", label: "Block", key: "b", zoneHint: "Mostly 0; optionally where the attack came from" },
  { id: "defense", label: "Defense", key: "d", zoneHint: "Where the player defended from" },
  { id: "freeball", label: "Freeball", key: "f", zoneHint: "Where the freeball went (0 = error)" },
  { id: "misc", label: "Misc", key: "m", zoneHint: "Any zone" },
];

export const SKILL_BY_KEY: Record<string, Skill> = Object.fromEntries(SKILLS.map((s) => [s.key, s.id]));

export const skillDef = (id: Skill): SkillDef => SKILLS.find((s) => s.id === id) ?? SKILLS[SKILLS.length - 1]!;

const DIG01 = "One or no attacking options";
const DIG23 = "Two or all attacking options";

export const RESULTS: Record<Exclude<Skill, "misc">, ResultDef[]> = {
  serve: [
    { id: "ace", label: "Ace", help: "Point for us", point: "us" },
    { id: "dig01", label: "Dig 0-1", help: `Opponent had ${DIG01.toLowerCase()}`, point: null },
    { id: "dig23", label: "Dig 2-3", help: `Opponent had ${DIG23.toLowerCase()}`, point: null },
    { id: "out", label: "Out", help: "Error", point: "them", autoZone: "0" },
    { id: "net", label: "Net", help: "Error", point: "them", autoZone: "0" },
  ],
  receive: [
    { id: "dig01", label: "Dig 0-1", help: DIG01, point: null },
    { id: "dig23", label: "Dig 2-3", help: DIG23, point: null },
    { id: "error", label: "Error", help: "Point to opponent", point: "them" },
  ],
  set: [
    { id: "on", label: "On", help: "We should be attacking", point: null },
    { id: "off", label: "Off", help: "Difficult to attack", point: null },
    { id: "over_score", label: "Over (pt)", help: "Sent over and scored", point: "us" },
    { id: "over_defended", label: "Over (def)", help: "Sent over, defended", point: null },
    { id: "error", label: "Error", help: "Point to opponent", point: "them", autoZone: "0" },
  ],
  attack: [
    { id: "kill", label: "Kill", help: "Point for us", point: "us" },
    { id: "defended", label: "Defended", help: "Ball still in play", point: null },
    { id: "block_tool", label: "Block tool", help: "Used the block for a point", point: "us" },
    { id: "block_inplay", label: "Blocked, in play", help: "Blocked but still in play", point: null },
    { id: "block_kill", label: "Blocked, kill", help: "Stuff block, point to opponent", point: "them", autoZone: "0" },
    { id: "out", label: "Out", help: "Error", point: "them", autoZone: "0" },
    { id: "net", label: "Net", help: "Error", point: "them", autoZone: "0" },
  ],
  block: [
    { id: "kill", label: "Kill", help: "Point for us", point: "us" },
    { id: "touch", label: "Touch", help: "Ball still in play", point: null },
    { id: "tool", label: "Tooled", help: "Error, point to opponent", point: "them" },
    { id: "net", label: "Net", help: "Error, point to opponent", point: "them", autoZone: "0" },
  ],
  defense: [
    { id: "dig01", label: "Dig 0-1", help: DIG01, point: null },
    { id: "dig23", label: "Dig 2-3", help: DIG23, point: null },
    { id: "error", label: "Error", help: "Point to opponent", point: "them" },
  ],
  freeball: [
    { id: "dig01", label: "Dig 0-1", help: `Opponent had ${DIG01.toLowerCase()}`, point: null },
    { id: "dig23", label: "Dig 2-3", help: `Opponent had ${DIG23.toLowerCase()}`, point: null },
    { id: "point", label: "Point", help: "Point for us", point: "us" },
    { id: "out", label: "Out", help: "Error", point: "them", autoZone: "0" },
    { id: "net", label: "Net", help: "Error", point: "them", autoZone: "0" },
  ],
};

export const resultsFor = (skill: Skill | ""): ResultDef[] => (skill && skill !== "misc" ? RESULTS[skill] : []);

export const resultDef = (skill: Skill, result: string): ResultDef | undefined =>
  resultsFor(skill).find((r) => r.id === result);

export const resultLabel = (skill: Skill, result: string): string => resultDef(skill, result)?.label ?? result;

/** The team a touch awards the rally to, or null if the ball stays in play. */
export const touchOutcome = (t: Pick<Touch, "stat" | "result">): Team | null =>
  resultDef(t.stat, t.result)?.point ?? null;

export type TouchReason = {
  id: string;
  label: string;
  /** Toggles the reason while entering the stat. Must not clash with skill keys. */
  key: string;
};

/** Optional reasons, offered only for specific skill + result combinations. */
export const TOUCH_REASONS: Partial<Record<Skill, Record<string, TouchReason[]>>> = {
  defense: {
    error: [{ id: "positioning", label: "Positioning", key: "p" }],
  },
};

export const touchReasonsFor = (skill: Skill | "", result: string): TouchReason[] =>
  (skill && TOUCH_REASONS[skill]?.[result]) || [];

export const touchReasonLabel = (skill: Skill, result: string, reason?: string): string =>
  touchReasonsFor(skill, result).find((r) => r.id === reason)?.label ?? reason ?? "";

export type PointReason = {
  id: string;
  label: string;
};

/**
 * Reasons for a manually recorded point, keyed by the team that won it.
 * "us" reasons are opponent errors; "them" reasons are how they scored.
 */
export const POINT_REASONS: Record<Team, PointReason[]> = {
  us: [
    { id: "serve_error", label: "Opp serve error" },
    { id: "attack_error", label: "Opp attack error" },
    { id: "fault", label: "Opp net / fault" },
    { id: "other", label: "Other" },
  ],
  // Only for balls none of our players touched; a touched one is our error
  // (defense/receive error, block tooled), recorded on that touch instead.
  them: [
    { id: "kill", label: "Opp kill, untouched" },
    { id: "ace", label: "Opp ace, untouched" },
    { id: "other", label: "Other" },
  ],
};

export const pointReasonLabel = (winner: Team, reason?: string): string =>
  POINT_REASONS[winner].find((r) => r.id === reason)?.label ?? "";

/** Court zones as seen from behind our baseline, net at the top. */
export const ZONE_GRID: (string | null)[][] = [
  [null, "4", "3", "2"],
  [null, "7", "8", "9"],
  ["0", "5", "6", "1"],
];

/**
 * Guess the next skill one of our players will perform, given the last touch
 * of the open rally (or null when the rally has not started yet).
 */
export function predictSkill(last: Touch | null, serving: Team | null): Skill | "" {
  if (!last) {
    if (serving === "us") return "serve";
    if (serving === "them") return "receive";

    return "";
  }
  switch (last.stat) {
    case "serve":
    case "freeball":
      return "defense";
    case "receive":
    case "defense":
      return "set";
    case "set":
      return last.result === "over_defended" ? "defense" : "attack";
    case "attack":
    case "block":
      return "defense";
    default:
      return "";
  }
}
