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
  { id: "serve", label: "Serve", key: "s", zoneHint: "Where the serve went" },
  { id: "receive", label: "Receive", key: "r", zoneHint: "Where the player received from" },
  { id: "set", label: "Set", key: "e", zoneHint: "Who was set: 1 back-row, 2 opp, 3 middle, 4 outside, 5 lib, 6 pipe" },
  { id: "attack", label: "Attack", key: "a", zoneHint: "Where the attack went" },
  { id: "block", label: "Block", key: "b", zoneHint: "Mostly 0; optionally where the attack came from" },
  { id: "defense", label: "Defense", key: "d", zoneHint: "Where the player defended from" },
  { id: "freeball", label: "Freeball", key: "f", zoneHint: "Where the freeball went" },
  { id: "misc", label: "Misc", key: "m", zoneHint: "Any zone" },
];

/** The skills the entry lists. A freeball is picked as a kind of attack, though its key still works. */
export const ENTRY_SKILLS: SkillDef[] = SKILLS.filter((s) => s.id !== "freeball");

export const SKILL_BY_KEY: Record<string, Skill> = Object.fromEntries(SKILLS.map((s) => [s.key, s.id]));

export const skillDef = (id: Skill): SkillDef => SKILLS.find((s) => s.id === id) ?? SKILLS[SKILLS.length - 1]!;

const DIG01 = "One or no attacking options";
const DIG23 = "Two or all attacking options";

const THEIR_DIGS: ResultDef[] = [
  { id: "dig01", label: "Dig 0-1", help: `Opponent had ${DIG01.toLowerCase()}`, point: null },
  { id: "dig23", label: "Dig 2-3", help: `Opponent had ${DIG23.toLowerCase()}`, point: null },
];
const BLOCKED: ResultDef[] = [
  { id: "block_tool", label: "Block tool", help: "Used the block for a point", point: "us" },
  { id: "block_inplay", label: "Blocked, in play", help: "Blocked but still in play", point: null },
  { id: "block_kill", label: "Blocked, kill", help: "Stuff block, point to opponent", point: "them", autoZone: "0" },
];
const OUT_NET: ResultDef[] = [
  { id: "out", label: "Out", help: "Error", point: "them", autoZone: "0" },
  { id: "net", label: "Net", help: "Error", point: "them", autoZone: "0" },
];
const KILL: ResultDef = { id: "kill", label: "Kill", help: "Point for us", point: "us" };
const POINT: ResultDef = { id: "point", label: "Point", help: "Point for us", point: "us" };

export const RESULTS: Record<Exclude<Skill, "misc">, ResultDef[]> = {
  serve: [{ id: "ace", label: "Ace", help: "Point for us", point: "us" }, ...THEIR_DIGS, ...OUT_NET],
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
    KILL,
    { id: "defended", label: "Defended", help: "Ball still in play", point: null },
    ...BLOCKED,
    ...OUT_NET,
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
  freeball: [...THEIR_DIGS, POINT, ...OUT_NET],
};

/** What a set recording detailed stats offers instead: every ball sent over shares one list, in one order. */
const DETAILED_RESULTS: Partial<Record<Skill, ResultDef[]>> = {
  attack: [KILL, ...THEIR_DIGS, ...BLOCKED, ...OUT_NET],
  freeball: [POINT, ...THEIR_DIGS, ...BLOCKED, ...OUT_NET],
};

/** The results the entry offers for a skill. */
export const resultsFor = (skill: Skill | "", detailed = false): ResultDef[] =>
  skill && skill !== "misc" ? (detailed && DETAILED_RESULTS[skill]) || RESULTS[skill] : [];

/** A recorded result's definition, whichever kind of set recorded it. */
export const resultDef = (skill: Skill, result: string): ResultDef | undefined =>
  [...resultsFor(skill), ...resultsFor(skill, true)].find((r) => r.id === result);

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

/** Our court's zones as seen from behind our baseline, net at the top. Zone 0 is no zone. */
export const ZONE_GRID: (string | null)[][] = [
  [null, "4", "3", "2"],
  [null, "7", "8", "9"],
  ["0", "5", "6", "1"],
];

/** The opponent's court from the same seat: the net at the bottom, every zone half a turn round. */
export const ZONE_GRID_THEIRS: (string | null)[][] = [
  ["0", "1", "6", "5"],
  [null, "9", "8", "7"],
  [null, "2", "3", "4"],
];

const THEIR_SIDE = new Set<Skill>(["serve", "attack", "freeball", "block"]);

/** Whose court a skill's zone is on. */
export const zoneSide = (skill: Skill): "ours" | "theirs" => (THEIR_SIDE.has(skill) ? "theirs" : "ours");

/** What the zone means for a touch: a blocked ball never reached a zone, so it rarely has one. */
export const zoneHint = (skill: Skill, result: string): string =>
  (skill === "attack" || skill === "freeball") && (result === "block_tool" || result === "block_inplay")
    ? "Mostly 0; optionally where the attacker aimed"
    : skillDef(skill).zoneHint;

/** Zone 0 on a touch: an error when its result is one, otherwise no zone. */
export const zeroLabel = (skill: Skill, result: string): string =>
  resultDef(skill, result)?.autoZone === undefined ? "N/A" : "Err";

export type TouchType = {
  id: string;
  label: string;
  /** Picks the type while entering a stat. Must not clash with skill or reason keys. */
  key: string;
  /** Only offered by a set recording detailed stats. */
  detailed?: true;
};

/** The kinds of attack. A freeball stays a skill of its own in the file. */
const ATTACK_TYPES: TouchType[] = [
  { id: "hit", label: "Hit", key: "h" },
  { id: "tip", label: "Tip", key: "t", detailed: true },
  { id: "freeball", label: "Freeball", key: "f" },
];

/** What a defense answers, recorded only with detailed stats. */
const DEFENSE_TYPES: TouchType[] = [
  { id: "hit", label: "Hit", key: "h", detailed: true },
  { id: "block_cover", label: "Block cover", key: "c", detailed: true },
  { id: "free_ball", label: "Free ball", key: "l", detailed: true },
  { id: "down_ball", label: "Down ball", key: "w", detailed: true },
];

const TYPES: Partial<Record<Skill, TouchType[]>> = {
  attack: ATTACK_TYPES,
  freeball: ATTACK_TYPES,
  defense: DEFENSE_TYPES,
};

/** The types the entry offers for a skill. */
export const typesFor = (skill: Skill | "", detailed: boolean): TouchType[] =>
  ((skill && TYPES[skill]) || []).filter((t) => detailed || !t.detailed);

/** The type a new touch of a skill starts with: a hit, when the set records types. */
export const defaultType = (skill: Skill | "", detailed: boolean): string =>
  detailed && (skill === "attack" || skill === "defense") ? "hit" : "";

/** A touch's skill as the log names it: a freeball as a kind of attack, and any other type after its skill. */
export function skillLabel({ stat, type }: Pick<Touch, "stat" | "type">): string {
  if (stat === "freeball") return "Attack, freeball";

  const named = type && type !== "hit" && TYPES[stat]?.find((t) => t.id === type);

  return named ? `${skillDef(stat).label}, ${named.label.toLowerCase()}` : skillDef(stat).label;
}

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

/** Guess what a defense answers: after our own attack came back off their block, it is a block cover. */
export const predictType = (last: Touch | null, stat: Skill | "", detailed: boolean): string =>
  detailed && stat === "defense" && last?.result === "block_inplay" ? "block_cover" : defaultType(stat, detailed);
