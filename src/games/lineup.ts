import type { Game, Lineup, PlayerOverride, Position, RosterPlayer } from "./types";

// Pure lineup operations over the game model. A lineup's positions are an array of six starters, index 0
// being official position I. Rotating moves everyone one position along the service order; a print version
// is the lineup shifted a number of positions up (I → II), so the common pair, setter in I and setter in II,
// is the lineup as entered plus a shift of one.

export const ROMAN = ["I", "II", "III", "IV", "V", "VI"] as const;

/** The position indices in court reading order from behind our end line: front row IV-III-II under the net,
 *  then back row V-VI-I. */
export const COURT_ORDER = [3, 2, 1, 4, 5, 0] as const;

/** A 5-1 in service order from the setter: S, OH, MB, OPP, OH, MB. */
export const FIVE_ONE: readonly Position[] = ["setter", "outside", "middle", "opposite", "outside", "middle"];

/** Every player moves `steps` positions up (I → II). A negative shift is the game rotation (II → I). */
export function shiftPositions<T>(positions: readonly T[], steps: number): T[] {
  return positions.map((_, i) => positions[(((i - steps) % 6) + 6) % 6]);
}

const byNumber = (a: RosterPlayer, b: RosterPlayer) => a.number - b.number;

/** A new lineup from the squad. It fills a 5-1 in service order from position I by each player's main
 *  position, leaving a position empty where the squad has no one left for it, and takes the first libero.
 *  Lower jersey numbers are picked first. */
export function createLineup(squad: readonly RosterPlayer[], name: string): Lineup {
  const pool = [...squad].sort(byNumber);
  const take = (position: Position): string | null => {
    const i = pool.findIndex((p) => p.main === position);

    return i < 0 ? null : pool.splice(i, 1)[0].id;
  };

  return {
    id: crypto.randomUUID(),
    name,
    positions: FIVE_ONE.map(take),
    libero: take("libero"),
    alternates: {},
    notes: "",
    printShifts: [0, 1],
    fiveOne: true,
  };
}

/** Put `playerId` at position `index`. A player already elsewhere in the lineup swaps with the occupant, so
 *  no one ever stands in two places. A starter who leaves the court takes their subs with them, and a player
 *  who comes onto it is no longer anyone's sub. */
export function assignPosition(lineup: Lineup, index: number, playerId: string | null): Lineup {
  const positions = [...lineup.positions];
  const from = playerId === null ? -1 : positions.indexOf(playerId);

  if (from >= 0) positions[from] = positions[index];
  positions[index] = playerId;

  const alternates = Object.fromEntries(
    Object.entries(lineup.alternates)
      .filter(([starter]) => positions.includes(starter))
      .map(([starter, alts]) => [starter, alts.filter((id) => !positions.includes(id))])
  );

  return { ...lineup, positions, alternates, libero: lineup.libero === playerId ? null : lineup.libero };
}

/** Make `playerId` the libero, taking them off every sub list. */
export function assignLibero(lineup: Lineup, playerId: string | null): Lineup {
  const alternates = Object.fromEntries(
    Object.entries(lineup.alternates).map(([starter, alts]) => [starter, alts.filter((id) => id !== playerId)])
  );

  return { ...lineup, libero: playerId, alternates };
}

/** Toggle a possible sub for a starter. */
export function toggleAlternate(lineup: Lineup, starterId: string, playerId: string): Lineup {
  const current = lineup.alternates[starterId] ?? [];
  const next = current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId];

  return { ...lineup, alternates: { ...lineup.alternates, [starterId]: next } };
}

/** The squad players who may be a starter's sub: anyone not on court, not the libero, and not already listed. */
export function eligibleSubs(lineup: Lineup, starterId: string, squad: readonly RosterPlayer[]): RosterPlayer[] {
  const taken = new Set([...lineup.positions, lineup.libero, ...(lineup.alternates[starterId] ?? [])]);

  return squad.filter((p) => !taken.has(p.id));
}

/** Set the game's squad, removing anyone dropped from it from every lineup and dropping their overrides. */
export function setSquad(game: Game, squad: string[]): Game {
  const keep = (id: string | null) => (id !== null && squad.includes(id) ? id : null);

  return {
    ...game,
    squad,
    overrides: Object.fromEntries(Object.entries(game.overrides).filter(([id]) => squad.includes(id))),
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

/** Set or clear one player's override for the game. An override equal to the roster is dropped. */
export function setOverride(game: Game, player: RosterPlayer, override: PlayerOverride): Game {
  const changed = Object.fromEntries(
    Object.entries(override).filter(([key, value]) => value !== player[key as keyof PlayerOverride])
  );
  const { [player.id]: _, ...rest } = game.overrides;

  return { ...game, overrides: Object.keys(changed).length ? { ...rest, [player.id]: changed } : rest };
}

/** The official position (0 = I) of the lineup's setter after `shift`, by the starters' main position, or
 *  null when no starter is a setter. */
export function setterIndex(lineup: Lineup, players: ReadonlyMap<string, RosterPlayer>, shift: number): number | null {
  const i = shiftPositions(lineup.positions, shift).findIndex((id) => id && players.get(id)?.main === "setter");

  return i < 0 ? null : i;
}

/** The position a 5-1 expects at `index`, around wherever the setter stands. With no setter on court yet,
 *  every position asks for one. Null when the lineup's 5-1 suggestions are off. */
export function expectedRole(
  lineup: Lineup,
  players: ReadonlyMap<string, RosterPlayer>,
  index: number
): Position | null {
  if (!lineup.fiveOne) return null;

  const setter = setterIndex(lineup, players, 0);

  return setter === null ? "setter" : FIVE_ONE[(index - setter + 6) % 6];
}

/** Players ranked for a position: those whose main position fits, then those who can also play it, then
 *  everyone else. Without a position, everyone is a fit. Each group is ordered by jersey number. */
export function rankForRole(
  players: readonly RosterPlayer[],
  role: Position | null
): { fits: RosterPlayer[]; canPlay: RosterPlayer[]; others: RosterPlayer[] } {
  const sorted = [...players].sort(byNumber);

  if (role === null) return { fits: sorted, canPlay: [], others: [] };

  return {
    fits: sorted.filter((p) => p.main === role),
    canPlay: sorted.filter((p) => p.main !== role && p.secondary === role),
    others: sorted.filter((p) => p.main !== role && p.secondary !== role),
  };
}

/** The overview slip's zones: at each position, every squad player whose main position a 5-1 puts there
 *  with the setter in I shifted by `shift`. Liberos are listed apart. */
export function overviewZones(
  squad: readonly RosterPlayer[],
  shift: number
): { zones: RosterPlayer[][]; liberos: RosterPlayer[] } {
  const sorted = [...squad].sort(byNumber);

  return {
    zones: shiftPositions(FIVE_ONE, shift).map((role) => sorted.filter((p) => p.main === role)),
    liberos: sorted.filter((p) => p.main === "libero"),
  };
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

/** The roster as a lookup for one game, archived players included so a game still resolves everyone it
 *  names, with the game's overrides applied. */
export function playerMap(
  roster: readonly RosterPlayer[],
  overrides: Readonly<Record<string, PlayerOverride>> = {}
): Map<string, RosterPlayer> {
  return new Map(roster.map((p) => [p.id, { ...p, ...overrides[p.id] }]));
}
