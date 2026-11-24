/** The set as one list in the order it happened: its recorded events, and the draft's contacts still to describe. */

import { RALLY_LEAD, RALLY_TAIL } from "./setDraft";
import type { DraftContact, DraftRally, MatchEvent, Rally, Team } from "./types";

export type TimelineItem =
  | { kind: "event"; time: number; event: MatchEvent }
  | { kind: "contact"; time: number; contact: DraftContact };

export type TimelineGroup = {
  key: string;
  rally: Rally;
  /** When the rally's serve is hit. The rally starts `RALLY_LEAD` before it. */
  start: number;
  /** When the rally ends: `RALLY_TAIL` after its last recorded event, or where the draft ends it. */
  end: number;
  items: TimelineItem[];
  /** How many of the items are contacts still to describe. */
  pending: number;
  /** Whether nothing of the rally is recorded yet, so it is known from the draft alone. */
  outline: boolean;
  /** Whether the rally's outcome rests on recorded events alone, not on a rally known from the draft alone. */
  settled: boolean;
};

/** An event standing in for the serve of a rally not recorded yet (see `serveStandIns`), which is no row of its own. */
const standIn = (e: MatchEvent): boolean => e.id < 0;

/** Whether nothing of a rally's play is recorded yet: no touch of ours and no serve of theirs. */
const unstarted = (r: Rally): boolean => ![...r.touches, ...r.opponent].some((e) => !standIn(e));

/**
 * From when a contact belongs to a rally: `RALLY_LEAD` before its serve. A rally with no play yet starts where the one
 * before ended, with no serve to lead up to, so it takes nothing from before that.
 */
const opensAt = (r: Rally): number => (r.touches.length || r.opponent.length ? r.startTime - RALLY_LEAD : r.startTime);

/**
 * The rally in play at `time`, when a contact there would be its first: nothing of its play is recorded and no
 * contact before it waits to be described. That contact is the rally's serve, and the rally says who serves and who
 * stands where.
 */
export function openingRally(rallies: readonly Rally[], contacts: readonly DraftContact[], time: number): Rally | null {
  const rally = rallies.filter((r) => opensAt(r) <= time).at(-1);

  if (!rally || !unstarted(rally)) return null;

  return contacts.some((c) => c.time < time && c.time >= opensAt(rally)) ? null : rally;
}

/**
 * Group the set's rows by rally, oldest first. The rallies are the app's own, derived with the draft's unrecorded
 * rallies standing in, so a contact simply joins the rally in play at its time. A rally shows once it holds a row,
 * has an outcome, or is known from the draft. The first contact of a rally with no play recorded shows as its serve,
 * by the side that serves it: ours always, and theirs when the set records their serves (`theirServes`).
 */
export function timeline(
  rallies: readonly Rally[],
  contacts: readonly DraftContact[],
  draft: readonly DraftRally[] = [],
  theirServes = false
): TimelineGroup[] {
  const groups = rallies.map((r, i) => {
    const events = [...r.subs, ...r.touches, ...r.opponent, ...(r.endedBy?.kind === "point" ? [r.endedBy] : [])];
    const recorded = events.filter((e) => !standIn(e));
    // A substitution is made before a rally, so it says nothing of where the rally ends.
    const played = recorded.filter((e) => e.kind !== "sub");

    return {
      key: `rally-${r.index}`,
      rally: r,
      start: r.startTime,
      end: played.length
        ? Math.max(...played.map((e) => e.timestamp)) + RALLY_TAIL
        : (draft.find((d) => d.start === r.startTime)?.end ?? r.endTime),
      items: recorded.map((event): TimelineItem => ({ kind: "event", time: event.timestamp, event })),
      outline: events.some(standIn),
      // An inferred outcome comes from the next rally's serve.
      settled: !r.inferred || ![...(rallies[i + 1]?.touches ?? []), ...(rallies[i + 1]?.opponent ?? [])].some(standIn),
    };
  });

  for (const contact of contacts) {
    const home = groups.filter((g) => opensAt(g.rally) <= contact.time).at(-1) ?? groups[0];

    home?.items.push({ kind: "contact", time: contact.time, contact });
  }

  return groups
    .filter((g) => g.items.length || g.rally.winner || g.outline)
    .map((g) => {
      const items = g.items.sort((a, b) => a.time - b.time || (a.kind === "event" ? -1 : 1));
      const first = items[0];

      const server = g.rally.serving;

      if (
        unstarted(g.rally) &&
        (server === "us" || (server === "them" && theirServes)) &&
        first?.kind === "contact" &&
        !first.contact.side &&
        !first.contact.skill
      )
        items[0] = { ...first, contact: { ...first.contact, side: server, skill: "serve" } };

      return { ...g, items, pending: items.filter((i) => i.kind === "contact").length };
    });
}

/**
 * The contact after (1) or before (-1) a place in the draft. The place is a contact's time and id, whether or not
 * that contact is still there, or a bare time. Contacts at the same time follow each other by id.
 */
export function neighbour(
  contacts: readonly DraftContact[],
  from: { time: number; id?: number },
  direction: 1 | -1
): DraftContact | undefined {
  const order = (c: { time: number; id?: number }) => c.time - from.time || (c.id ?? 0) - (from.id ?? c.id ?? 0);

  return direction === 1 ? contacts.find((c) => order(c) > 0) : contacts.filter((c) => order(c) < 0).at(-1);
}

const BALLS: readonly string[] = ["serve", "attack", "freeball"];

/** Whose touch a row is, or null for a row that is neither team's touch (a point, a substitution). */
const sideOf = (item: TimelineItem): Team | null =>
  item.kind === "contact"
    ? (item.contact.side ?? "us")
    : item.event.kind === "touch"
      ? "us"
      : item.event.kind === "opponent"
        ? "them"
        : null;

/** Whether a row sends the ball over the net, which ends its team's possession. */
const sendsOver = (item: TimelineItem): boolean =>
  item.kind === "contact"
    ? BALLS.includes(item.contact.skill ?? "")
    : (item.event.kind === "touch" && BALLS.includes(item.event.stat)) || item.event.kind === "opponent";

type Possession = { side: Team | null; items: TimelineItem[] };

const isBlock = (item: TimelineItem): boolean =>
  item.kind === "contact" ? item.contact.skill === "block" : item.event.kind === "touch" && item.event.stat === "block";

/** How many of a team's three touches a possession holds. A block does not count as one. */
const touches = (p: Possession): number => p.items.filter((i) => !isBlock(i)).length;

/**
 * A rally's rows as possessions: each team's touches from the ball reaching them to their sending it back, three at
 * most besides a block. A row that is neither team's touch stands alone.
 */
export function possessions(items: readonly TimelineItem[]): Possession[] {
  const blocks: Possession[] = [];

  for (const item of items) {
    const side = sideOf(item);
    const last = blocks.at(-1);

    if (last && side && last.side === side && !sendsOver(last.items.at(-1)!) && touches(last) < 3)
      last.items.push(item);
    else blocks.push({ side, items: [item] });
  }

  return blocks;
}

/** Whether two rows are the same one. */
export const sameRow = (a: TimelineItem, b: { kind: "event" | "contact"; id: number }): boolean =>
  a.kind === b.kind && (a.kind === "contact" ? a.contact.id : a.event.id) === b.id;

/**
 * The row after (1) or before (-1) `current` in `rows`, which are in time order. Without a current row, the one
 * after or before `time`.
 */
export function stepRow(
  rows: readonly TimelineItem[],
  current: { kind: "event" | "contact"; id: number } | null,
  time: number,
  direction: 1 | -1
): TimelineItem | undefined {
  const at = current ? rows.findIndex((r) => sameRow(r, current)) : -1;

  if (at >= 0) return rows[at + direction];

  return direction === 1 ? rows.find((r) => r.time > time) : rows.filter((r) => r.time < time).at(-1);
}
