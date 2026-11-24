import type { AppData, DraftContact, DraftRally, MatchEvent, MatchMeta, SetDraft, Skill, Team } from "./types";

// The draft layer of a set: contacts that have a time and still need describing, and the rallies a model found.
// The recorder's own marks and a model's contacts are completed the same way. A model's answer is read into a small
// format of its own by `parseDraft`, and `loadDraft` adds it to the set.

/** A draft contact this close to a recorded touch is that touch, so it is done. */
const DONE_WINDOW = 1.5;

type OurSkill = Exclude<Skill, "misc">;

const OUR_SKILLS: readonly string[] = ["serve", "receive", "set", "attack", "block", "defense", "freeball"];

const isTeam = (value: unknown): value is Team => value === "us" || value === "them";
const isTime = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const byTime = (a: DraftContact, b: DraftContact): number => a.time - b.time || a.id - b.id;

/** `data` with `draft`, or without one when it holds nothing. */
export function withDraft(data: AppData, draft: SetDraft | undefined): AppData {
  const { draft: _old, ...rest } = data;

  return draft && (draft.rallies.length || draft.contacts.length) ? { ...rest, draft } : rest;
}

/** A set without its draft, as its saved stats hold it. */
export const withoutDraft = (data: AppData): AppData => withDraft(data, undefined);

/** The draft of a set file: whatever of it reads as rallies and contacts, the rest left out. */
export function readDraft(raw: unknown): SetDraft | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const { rallies, contacts } = raw as { rallies?: unknown; contacts?: unknown };
  const list = (value: unknown): Record<string, unknown>[] =>
    Array.isArray(value) ? value.filter((v) => v && typeof v === "object") : [];

  return {
    rallies: list(rallies)
      .filter((r) => isTime(r.start) && isTime(r.end))
      .map((r) => ({ start: r.start as number, end: r.end as number, serving: isTeam(r.serving) ? r.serving : null })),
    contacts: list(contacts)
      .filter((c) => typeof c.id === "number" && isTime(c.time))
      .map((c) => ({
        id: c.id as number,
        time: c.time as number,
        ...(isTeam(c.side) && { side: c.side }),
        ...(OUR_SKILLS.includes(c.skill as string) && { skill: c.skill as DraftContact["skill"] }),
        ...(c.model === true && { model: true as const }),
      }))
      .sort(byTime),
  };
}

/** How long before a rally's serve the rally starts, and how long after its last touch it ends, in seconds. */
export const RALLY_LEAD = 3;
export const RALLY_TAIL = 1;

/**
 * The draft's rallies no play is recorded of yet: no touch of ours and no serve of theirs lies inside them. A point
 * or a substitution is not play, and may belong to the rally before.
 */
const openRallies = (data: AppData): DraftRally[] =>
  (data.draft?.rallies ?? []).filter(
    (r) =>
      !data.events.some(
        (e) =>
          (e.kind === "touch" || e.kind === "opponent") &&
          e.timestamp >= r.start - RALLY_LEAD &&
          e.timestamp <= r.end + RALLY_TAIL
      )
  );

/** The draft without the rally whose serve is at `start`, for one a model found that is none. */
export const dropRally = (draft: SetDraft | undefined, start: number): SetDraft | undefined =>
  draft && { ...draft, rallies: draft.rallies.filter((r) => r.start !== start) };

/**
 * A serve for each rally of the draft that is not recorded yet, by the side the draft says serves it. The app's own
 * rally rules then count those rallies too: who serves a rally tells who won the one before. A stand-in goes once
 * anything of its rally is recorded. Their ids are negative, which no recorded event has.
 */
export const serveStandIns = (data: AppData): MatchEvent[] =>
  openRallies(data)
    .filter((r) => r.serving)
    .map((r, i) =>
      r.serving === "them"
        ? { kind: "opponent", id: -1 - i, timestamp: r.start, stat: "serve" }
        : // A serve result that scores no point, so the stand-in only opens its rally.
          { kind: "touch", id: -1 - i, timestamp: r.start, player: "", stat: "serve", zone: "", result: "dig23" }
    );

/** The contacts still to describe, in the order they happen. Of the opponent's, only a serve is one. */
export const pendingContacts = (data: AppData): DraftContact[] =>
  (data.draft?.contacts ?? []).filter((c) => c.side !== "them" || c.skill === "serve");

const nextId = (contacts: readonly DraftContact[]): number => Math.max(0, ...contacts.map((c) => c.id)) + 1;

/** The draft with a contact the recorder marked at `time`. */
export function addMark(draft: SetDraft | undefined, time: number): SetDraft {
  const contacts = draft?.contacts ?? [];

  return { rallies: draft?.rallies ?? [], contacts: [...contacts, { id: nextId(contacts), time }].sort(byTime) };
}

/** The draft with one contact at another time. */
export const moveContact = (draft: SetDraft | undefined, id: number, time: number): SetDraft | undefined =>
  draft && { ...draft, contacts: draft.contacts.map((c) => (c.id === id ? { ...c, time } : c)).sort(byTime) };

export const removeContact = (draft: SetDraft | undefined, id: number): SetDraft | undefined =>
  draft && { ...draft, contacts: draft.contacts.filter((c) => c.id !== id) };

/** The draft without the recorder's own marks, or without what a model placed. */
export const dropContacts = (draft: SetDraft | undefined, which: "marks" | "model"): SetDraft | undefined =>
  draft && {
    rallies: which === "model" ? [] : draft.rallies,
    contacts: draft.contacts.filter((c) => !!c.model === (which === "marks")),
  };

/** Where to jump for the next rally after `time` (or with -1 the one before), by the times of the rallies' serves. */
export function serveJump(serves: readonly number[], time: number, direction: 1 | -1 = 1): number | null {
  const starts = serves.map((serve) => Math.max(0, serve - RALLY_LEAD)).sort((a, b) => a - b);

  return (direction === 1 ? starts.find((s) => s > time + 0.5) : starts.reverse().find((s) => s < time - 0.5)) ?? null;
}

// ---------------------------------------------------------------------------
// A model's draft

/** A contact as a model gives it: either side, with one of our seven skill names. */
type ModelContact = { time: number; side?: Team; skill?: OurSkill };

export type ModelDraft = { rallies: DraftRally[]; contacts: ModelContact[] };

type ParsedDraft = { ok: true; draft: ModelDraft; notices: string[] } | { ok: false; errors: string[] };

/** A time in seconds: a number, or text as seconds, MM:SS or H:MM:SS. */
export function readTime(value: unknown): number | null {
  if (isTime(value)) return value;
  if (typeof value !== "string" || !/^\d+(:\d{1,2}){0,2}(\.\d+)?s?$/.test(value.trim())) return null;

  return value
    .trim()
    .replace(/s$/, "")
    .split(":")
    .reduce((total, part) => total * 60 + parseFloat(part), 0);
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/**
 * Read a draft a model wrote. It is strict on structure and lenient on content: text that is not the format is an
 * error, while a rally or contact it cannot read is dropped and counted in a notice.
 *
 * The format is `{"rallies": [{"start", "end", "serving", "contacts": [[time, side, skill], ...]}]}`. A contact may
 * also be an object with those three names, and a rally may give its start as `serve` and its contacts as `touches`.
 */
export function parseDraft(text: string): ParsedDraft {
  // A chat answer wraps its JSON in a code fence or a sentence: take what lies between the outer braces.
  const body = /\{[\s\S]*\}/.exec(text)?.[0];

  if (!body) return { ok: false, errors: ["No draft found: expected JSON with a list of rallies."] };

  let raw: unknown;

  try {
    raw = JSON.parse(body);
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${e instanceof Error ? e.message : String(e)}`] };
  }

  const top = raw as { rallies?: unknown; contacts?: unknown };

  if (!Array.isArray(top.rallies)) return { ok: false, errors: ['Not a draft: it has no "rallies" list.'] };

  const dropped = { rallies: 0, contacts: 0, skills: 0, sides: 0 };
  const rallies: DraftRally[] = [];
  const contacts: ModelContact[] = [];

  const readContacts = (list: unknown) => {
    for (const item of Array.isArray(list) ? list : []) {
      const c = (Array.isArray(item) ? { time: item[0], side: item[1], skill: item[2] } : (item ?? {})) as Record<
        string,
        unknown
      >;
      const time = readTime(c.time ?? c.t);

      if (time === null) {
        dropped.contacts++;
        continue;
      }
      if (!isTeam(c.side)) dropped.sides++;
      if (!OUR_SKILLS.includes(c.skill as string)) dropped.skills++;
      contacts.push({
        time,
        ...(isTeam(c.side) && { side: c.side }),
        ...(OUR_SKILLS.includes(c.skill as string) && { skill: c.skill as OurSkill }),
      });
    }
  };

  for (const item of top.rallies) {
    const r = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const start = readTime(r.start ?? r.serve);

    readContacts(r.contacts ?? r.touches);

    if (start === null) {
      dropped.rallies++;
      continue;
    }

    rallies.push({
      start,
      end: Math.max(start, readTime(r.end) ?? start),
      serving: isTeam(r.serving) ? r.serving : null,
    });
  }
  readContacts(top.contacts);

  if (!rallies.length && !contacts.length)
    return { ok: false, errors: ["The draft holds no rally and no contact that can be read."] };

  const notices = [
    dropped.rallies &&
      `${plural(dropped.rallies, "rally has no start time and was", "rallies have no start time and were")} left out.`,
    dropped.contacts &&
      `${plural(dropped.contacts, "contact has no time and was", "contacts have no time and were")} left out.`,
    dropped.sides && `${plural(dropped.sides, "contact names", "contacts name")} no side.`,
    dropped.skills && `${plural(dropped.skills, "contact has", "contacts have")} no skill the tracker knows.`,
  ].filter((n): n is string => !!n);

  return {
    ok: true,
    draft: { rallies: rallies.sort((a, b) => a.start - b.start), contacts: contacts.sort((a, b) => a.time - b.time) },
    notices,
  };
}

/**
 * Add a model's draft to a set's. Of the opponent's touches it keeps their serves, which is all a set records of
 * them. A contact within `DONE_WINDOW` of a recorded touch of the same side is done already.
 */
export function loadDraft(data: AppData, model: ModelDraft): SetDraft {
  const kept: Omit<DraftContact, "id">[] = model.contacts
    .filter((c) => c.side !== "them" || c.skill === "serve")
    .map((c) => ({ time: c.time, ...(c.side && { side: c.side }), ...(c.skill && { skill: c.skill }), model: true }));

  // Pair each recorded touch with the nearest contact of its side, closest pairs first.
  const recorded = data.events.flatMap((e): { time: number; side: Team }[] =>
    e.kind === "touch"
      ? [{ time: e.timestamp, side: "us" }]
      : e.kind === "opponent"
        ? [{ time: e.timestamp, side: "them" }]
        : []
  );
  const pairs = recorded
    .flatMap((r, i) =>
      kept.map((c, j) => ({ i, j, gap: Math.abs(c.time - r.time), sides: !c.side || c.side === r.side }))
    )
    .filter((p) => p.sides && p.gap <= DONE_WINDOW)
    .sort((a, b) => a.gap - b.gap);
  const used = new Set<number>();
  const done = new Set<number>();

  for (const { i, j } of pairs) {
    if (used.has(i) || done.has(j)) continue;
    used.add(i);
    done.add(j);
  }

  const before = data.draft?.contacts ?? [];
  const first = nextId(before);

  return {
    rallies: [...(data.draft?.rallies ?? []), ...model.rallies].sort((a, b) => a.start - b.start),
    contacts: [...before, ...kept.filter((_, j) => !done.has(j)).map((c, n) => ({ ...c, id: first + n }))].sort(byTime),
  };
}

const HALF = {
  near: 'Our team ("us") plays on the half of the court nearer to the camera. The opponent ("them") plays on the far half, beyond the net.',
  far: 'Our team ("us") plays on the far half of the court, beyond the net. The opponent ("them") plays on the half nearer to the camera.',
};

const TURN = {
  90: "The video is stored turned a quarter turn clockwise: turn it a quarter turn counterclockwise in your head, so the net runs across the picture.",
  180: "The video is stored upside down: turn it half a turn in your head.",
  270: "The video is stored turned a quarter turn counterclockwise: turn it a quarter turn clockwise in your head, so the net runs across the picture.",
};

/** The sentences that tell a model which half is ours and how the video is stored. */
export const sceneText = (meta: Pick<MatchMeta, "ourHalf" | "videoTurn">): string =>
  [HALF[meta.ourHalf ?? "near"], meta.videoTurn && TURN[meta.videoTurn]].filter(Boolean).join("\n");

export const SKILL_TEXT = `Give each touch one of these skills:
- serve: the hit from behind the end line that starts the rally.
- receive: a team's first touch on the opponent's serve.
- set: the touch that puts the ball up for a teammate to attack, normally a team's second touch.
- attack: a ball sent over the net to score: a spike, a tip, a roll shot, a hard-driven ball.
- block: a player at the net who touches the opponent's attack with the hands above the net.
- defense: a dig. A team's first touch on the opponent's attack or freeball, or picking up a ball that came off a block.
- freeball: an easy ball given over the net without an attack, such as a forearm pass or a high ball.`;
