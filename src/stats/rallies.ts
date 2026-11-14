import { touchOutcome } from "./codes";
import type { Court, MatchEvent, MatchMeta, Rally, Skill, Team, Touch } from "./types";

export const sortEvents = (events: MatchEvent[]): MatchEvent[] =>
  [...events].sort((a, b) => a.timestamp - b.timestamp || a.id - b.id);

/** Seconds within which a serve/receive may be tagged after the touches that followed it. */
const MISORDER_WINDOW = 3;

const inferServe = (t: Touch): Team | null => (t.stat === "serve" ? "us" : t.stat === "receive" ? "them" : null);

/**
 * Split the event log into rallies and work out who won each one.
 *
 * A rally ends in one of three ways:
 *  1. one of our touches is decisive (kill, ace, error...);
 *  2. a point is recorded manually (e.g. an untouched ace);
 *  3. inferred: the winner of a rally serves the next one, so our next serve
 *     means we won the previous rally and our next receive means they did.
 *
 * Rule 3 also detects whole rallies with none of our touches in them: if they
 * should be serving but our next touch is a serve, we must have won a rally in
 * between (typically an opponent serve error).
 *
 * Score, serving team and rotation all follow from the winners. With a
 * starting lineup, the court rotates one position on every side-out and
 * substitutions swap a player in place, so every rally knows who is on court
 * and who serves (position 1). The last element is always the open (unfinished) rally, possibly empty.
 */
export function deriveRallies(
  events: MatchEvent[],
  meta: Pick<MatchMeta, "firstServe" | "startRotation"> & Partial<Pick<MatchMeta, "lineup" | "libero">>
): Rally[] {
  const rallies: Rally[] = [];
  let serving: Team | null = meta.firstServe;
  let rotation = meta.startRotation || 1;
  const score = { us: 0, them: 0 };

  // Players by *starting* position; `turns` side-outs later, position p holds slots[(p + turns) % 6].
  const slots = meta.lineup?.length === 6 ? [...meta.lineup] : null;
  let libero = meta.libero ?? "";
  let turns = 0;
  const courtNow = (): Court | null => slots && { positions: slots.map((_, p) => slots[(p + turns) % 6]!), libero };

  const open = (startTime: number): Rally => ({
    index: rallies.length + 1,
    startTime,
    endTime: startTime,
    serving,
    rotation,
    touches: [],
    winner: null,
    endedBy: null,
    inferred: false,
    court: courtNow(),
    subs: [],
    score: { ...score },
  });

  let current = open(0);

  const close = (winner: Team, by: MatchEvent | null, time: number) => {
    score[winner] += 1;
    current.winner = winner;
    current.endedBy = by;
    current.inferred = by === null;
    current.endTime = time;
    current.score = { ...score };
    if (winner === "us" && current.serving === "them") {
      rotation = (rotation % 6) + 1;
      turns += 1;
    }
    serving = winner;
    rallies.push(current);
    current = open(time);
  };

  for (const e of sortEvents(events)) {
    if (e.kind === "sub") {
      const slot = slots?.indexOf(e.out) ?? -1;

      if (slots && slot >= 0) slots[slot] = e.in;
      else if (e.out === libero) libero = e.in;
      current.subs.push(e);
      current.court = courtNow();
      continue;
    }
    if (e.kind === "point") {
      close(e.winner, e, e.timestamp);
      continue;
    }

    const server = inferServe(e);
    // Every rally with our touches opens with our serve or receive. If one turns
    // up just after a few touches that had neither, it was tagged slightly out of
    // order: it opens this rally rather than starting the next one.
    const startsCurrent =
      server !== null &&
      current.touches.length > 0 &&
      !current.touches.some((t) => inferServe(t)) &&
      e.timestamp - current.startTime <= MISORDER_WINDOW;

    if (startsCurrent) {
      const stray = current.touches;

      if (current.serving !== null && current.serving !== server) {
        // ...and the wrong team was serving, so a rally we never touched came first.
        current.touches = [];
        close(server, null, current.startTime);
      }
      current.serving = serving = server;
      current.touches = [e, ...stray];
      current.startTime = Math.min(e.timestamp, current.startTime);
      current.endTime = Math.max(e.timestamp, ...stray.map((t) => t.timestamp));
      const winner = touchOutcome(e);

      if (winner) close(winner, e, current.endTime);
      continue;
    }

    if (server) {
      if (current.touches.length > 0) {
        // A serve/receive mid-rally means that rally ended unrecorded.
        close(server, null, current.endTime);
      } else if (serving !== null && serving !== server) {
        // Wrong team serving: a rally with none of our touches happened in between.
        close(server, null, current.startTime);
      }
    }

    if (current.touches.length === 0) {
      current.startTime = e.timestamp;
      if (current.serving === null) current.serving = serving = server;
    }
    current.touches.push(e);
    current.endTime = e.timestamp;
    const winner = touchOutcome(e);

    if (winner) close(winner, e, e.timestamp);
  }

  rallies.push(current);

  return rallies;
}

/** Guess which player performs `skill` next, from what happened earlier in the set. */
export function predictPlayer(rallies: Rally[], skill: Skill | ""): string {
  const current = rallies[rallies.length - 1];

  if (!current) return "";
  const done = rallies.slice(0, -1);

  if (skill === "serve") {
    // With a lineup, the server is whoever stands in position 1.
    if (current.court) return current.court.positions[0] ?? "";
    // Otherwise: same rotation as an earlier rally we served in → same server.
    for (let i = done.length - 1; i >= 0; i--) {
      const r = done[i]!;

      if (r.serving === "us" && r.rotation === current.rotation) {
        const serve = r.touches.find((t) => t.stat === "serve");

        if (serve) return serve.player;
      }
    }

    return "";
  }

  if (skill === "set") {
    for (let i = rallies.length - 1; i >= 0; i--) {
      const touches = rallies[i].touches;

      for (let j = touches.length - 1; j >= 0; j--) {
        if (touches[j].stat === "set") return touches[j].player;
      }
    }
  }

  return "";
}
