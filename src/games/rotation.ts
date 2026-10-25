import { POSITIONS } from "./types";
import type { Game, Rotation, PlayerOverride, Position, RosterPlayer } from "./types";

// Pure rotation operations over the game model. A rotation's positions are an array of six starters, index 0
// being official position I. Rotating moves everyone one position along the service order; a print version
// is the rotation shifted a number of positions up (I → II), so the common pair, setter in I and setter in II,
// is the rotation as entered plus a shift of one.

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

/** Turn a coach's rotation, keeping each chosen print version where it was. */
export function rotateBy(rotation: Rotation, steps: number): Rotation {
  return {
    ...rotation,
    positions: shiftPositions(rotation.positions, steps),
    printShifts: rotation.printShifts.map((s) => (((s - steps) % 6) + 6) % 6),
  };
}

/** Secondary positions in the fixed position order, without the main one. */
export const secondaryOf = (positions: readonly string[], main: Position): Position[] =>
  POSITIONS.filter((p) => p !== main && positions.includes(p));

const byNumber = (a: RosterPlayer, b: RosterPlayer) => a.number - b.number;

/** A new rotation from the squad. It fills a 5-1 in service order from position I by each player's main
 *  position, leaving a position empty where the squad has no one left for it, and takes the first libero.
 *  Lower jersey numbers are picked first. */
export function createRotation(squad: readonly RosterPlayer[], name: string): Rotation {
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

/** Put `playerId` at position `index`. A player already elsewhere in the rotation swaps with the occupant, so
 *  no one ever stands in two places. A starter who leaves the court takes their subs with them, and a player
 *  who comes onto it is no longer anyone's sub. */
export function assignPosition(rotation: Rotation, index: number, playerId: string | null): Rotation {
  const positions = [...rotation.positions];
  const from = playerId === null ? -1 : positions.indexOf(playerId);

  if (from >= 0) positions[from] = positions[index];
  positions[index] = playerId;

  const alternates = Object.fromEntries(
    Object.entries(rotation.alternates)
      .filter(([starter]) => positions.includes(starter))
      .map(([starter, alts]) => [starter, alts.filter((id) => !positions.includes(id))])
  );

  return { ...rotation, positions, alternates, libero: rotation.libero === playerId ? null : rotation.libero };
}

export function assignLibero(rotation: Rotation, playerId: string | null): Rotation {
  const alternates = Object.fromEntries(
    Object.entries(rotation.alternates).map(([starter, alts]) => [starter, alts.filter((id) => id !== playerId)])
  );

  return { ...rotation, libero: playerId, alternates };
}

export function toggleAlternate(rotation: Rotation, starterId: string, playerId: string): Rotation {
  const current = rotation.alternates[starterId] ?? [];
  const next = current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId];

  return { ...rotation, alternates: { ...rotation.alternates, [starterId]: next } };
}

/** The squad players who may be a starter's sub: anyone not on court, not the libero, and not already listed. */
export function eligibleSubs(rotation: Rotation, starterId: string, squad: readonly RosterPlayer[]): RosterPlayer[] {
  const taken = new Set([...rotation.positions, rotation.libero, ...(rotation.alternates[starterId] ?? [])]);

  return squad.filter((p) => !taken.has(p.id));
}

/** Set the game's squad, removing anyone dropped from it from every rotation and dropping their overrides. */
export function setSquad(game: Game, squad: string[]): Game {
  const keep = (id: string | null) => (id !== null && squad.includes(id) ? id : null);

  return {
    ...game,
    squad,
    overrides: Object.fromEntries(Object.entries(game.overrides).filter(([id]) => squad.includes(id))),
    rotations: game.rotations.map((l) => ({
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
    Object.entries(override).filter(
      ([key, value]) => JSON.stringify(value) !== JSON.stringify(player[key as keyof PlayerOverride])
    )
  );
  const { [player.id]: _, ...rest } = game.overrides;

  return { ...game, overrides: Object.keys(changed).length ? { ...rest, [player.id]: changed } : rest };
}

/** The official position (0 = I) of the rotation's setter after `shift`, by the starters' main position, or
 *  null when no starter is a setter. */
export function setterIndex(
  rotation: Rotation,
  players: ReadonlyMap<string, RosterPlayer>,
  shift: number
): number | null {
  const i = shiftPositions(rotation.positions, shift).findIndex((id) => id && players.get(id)?.main === "setter");

  return i < 0 ? null : i;
}

/** The position a 5-1 expects at `index`, around wherever the setter stands. With no setter on court yet,
 *  every position asks for one. Null when the rotation's 5-1 suggestions are off. */
export function expectedRole(
  rotation: Rotation,
  players: ReadonlyMap<string, RosterPlayer>,
  index: number
): Position | null {
  if (!rotation.fiveOne) return null;

  const setter = setterIndex(rotation, players, 0);

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
    canPlay: sorted.filter((p) => p.main !== role && p.secondary.includes(role)),
    others: sorted.filter((p) => p.main !== role && !p.secondary.includes(role)),
  };
}

/** The overview slip's zones: the role a 5-1 puts at each position with the setter in I shifted by `shift`,
 *  and every squad player whose main position is that role. Liberos are listed apart. */
export function overviewZones(
  squad: readonly RosterPlayer[],
  shift: number
): { roles: Position[]; zones: RosterPlayer[][]; liberos: RosterPlayer[] } {
  const sorted = [...squad].sort(byNumber);
  const roles = shiftPositions(FIVE_ONE, shift);

  return {
    roles,
    zones: roles.map((role) => sorted.filter((p) => p.main === role)),
    liberos: sorted.filter((p) => p.main === "libero"),
  };
}

/** Print shifts in reading order: by where the setter stands (I first), else by the shift itself. */
export function sortShifts(
  rotation: Rotation,
  players: ReadonlyMap<string, RosterPlayer>,
  shifts: readonly number[]
): number[] {
  const key = (shift: number) => setterIndex(rotation, players, shift) ?? shift;

  return [...shifts].sort((a, b) => key(a) - key(b));
}

/** How a print version reads: where the setter stands, or the shift itself for a rotation without one. */
export function versionLabel(rotation: Rotation, players: ReadonlyMap<string, RosterPlayer>, shift: number): string {
  const setter = setterIndex(rotation, players, shift);

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

/** The squad as listed above the rotations: by number, liberos last. */
export function sortSquad(squad: readonly RosterPlayer[]): RosterPlayer[] {
  return [...squad].sort((a, b) => Number(a.main === "libero") - Number(b.main === "libero") || a.number - b.number);
}
