import type { Game, Lineup, Position, RosterPlayer } from "./types";

// Pure lineup operations over the game model. A lineup's positions are an array of six starters, index 0
// being official position I. Rotating moves everyone one position along the service order; a print version
// is the lineup shifted a number of positions up (I → II), so the common pair, setter in I and setter in II,
// is the lineup as entered plus a shift of one.

export const ROMAN = ["I", "II", "III", "IV", "V", "VI"] as const;

/** The position indices in court reading order from behind our end line: front row IV-III-II under the net,
 *  then back row V-VI-I. */
export const COURT_ORDER = [3, 2, 1, 4, 5, 0] as const;

/** Every player moves `steps` positions up (I → II). A negative shift is the game rotation (II → I). */
export function shiftPositions<T>(positions: readonly T[], steps: number): T[] {
  return positions.map((_, i) => positions[(((i - steps) % 6) + 6) % 6]);
}

const byNumber = (a: RosterPlayer, b: RosterPlayer) => a.number - b.number;

/** A new lineup from the squad. It fills a 5-1 in service order (S, OH, MB, OPP, OH, MB) from position I by
 *  each player's main position, leaving a position empty where the squad has no one left for it, and takes
 *  the first libero. Lower jersey numbers are picked first. */
export function createLineup(squad: readonly RosterPlayer[], name: string): Lineup {
  const pool = [...squad].sort(byNumber);
  const take = (position: Position): string | null => {
    const i = pool.findIndex((p) => p.main === position);

    return i < 0 ? null : pool.splice(i, 1)[0].id;
  };
  const order: Position[] = ["setter", "outside", "middle", "opposite", "outside", "middle"];

  return {
    id: crypto.randomUUID(),
    name,
    positions: order.map(take),
    libero: take("libero"),
    alternates: {},
    notes: "",
    printShifts: [0, 1],
  };
}

/** Put `playerId` at position `index`. A player already elsewhere in the lineup swaps with the occupant, so
 *  no one ever stands in two places; alternates of a starter who leaves the court are dropped. */
export function assignPosition(lineup: Lineup, index: number, playerId: string | null): Lineup {
  const positions = [...lineup.positions];
  const from = playerId === null ? -1 : positions.indexOf(playerId);

  if (from >= 0) positions[from] = positions[index];
  positions[index] = playerId;

  const alternates = Object.fromEntries(
    Object.entries(lineup.alternates).filter(([starter]) => positions.includes(starter))
  );

  return { ...lineup, positions, alternates, libero: lineup.libero === playerId ? null : lineup.libero };
}

/** Toggle a planned alternative for a starter. */
export function toggleAlternate(lineup: Lineup, starterId: string, playerId: string): Lineup {
  const current = lineup.alternates[starterId] ?? [];
  const next = current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId];

  return { ...lineup, alternates: { ...lineup.alternates, [starterId]: next } };
}

/** Set the game's squad, removing anyone dropped from it from every lineup. */
export function setSquad(game: Game, squad: string[]): Game {
  const keep = (id: string | null) => (id !== null && squad.includes(id) ? id : null);

  return {
    ...game,
    squad,
    lineups: game.lineups.map((l) => ({
      ...l,
      positions: l.positions.map(keep),
      libero: keep(l.libero),
      alternates: Object.fromEntries(
        Object.entries(l.alternates)
          .filter(([starter]) => squad.includes(starter))
          .map(([starter, alts]) => [starter, alts.filter((id) => squad.includes(id))])
      ),
    })),
  };
}

/** The official position (0 = I) of the lineup's setter after `shift`, by the starters' main position, or
 *  null when no starter is a setter. */
export function setterIndex(lineup: Lineup, players: ReadonlyMap<string, RosterPlayer>, shift: number): number | null {
  const i = shiftPositions(lineup.positions, shift).findIndex((id) => id && players.get(id)?.main === "setter");

  return i < 0 ? null : i;
}

/** Print shifts in reading order: by where the setter stands (I first), else by the shift itself. */
export function sortShifts(
  lineup: Lineup,
  players: ReadonlyMap<string, RosterPlayer>,
  shifts: readonly number[]
): number[] {
  const key = (shift: number) => setterIndex(lineup, players, shift) ?? shift;

  return [...shifts].sort((a, b) => key(a) - key(b));
}

/** How a print version reads: where the setter stands, or the shift itself for a lineup without one. */
export function versionLabel(lineup: Lineup, players: ReadonlyMap<string, RosterPlayer>, shift: number): string {
  const setter = setterIndex(lineup, players, shift);

  if (setter !== null) return `Setter in ${ROMAN[setter]}`;

  return shift === 0 ? "As entered" : `Shifted ${shift}`;
}

/** The roster as a lookup, archived players included, so a game still resolves everyone it names. */
export function playerMap(roster: readonly RosterPlayer[]): Map<string, RosterPlayer> {
  return new Map(roster.map((p) => [p.id, p]));
}
