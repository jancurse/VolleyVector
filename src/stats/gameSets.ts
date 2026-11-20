import { playerMap, sortSquad } from "../games/rotation";
import type { Game, RosterPlayer } from "../games/types";
import { emptyData, nextSetData } from "./store";
import { readBackup } from "./sync/setSync";
import type { Backup } from "./sync/setSync";
import type { AppData, MatchMeta } from "./types";

// How a game's sets relate to the game. A set file names players only by name, so a set player is the roster
// player with that name. The game owns the teams and date: a set is shown with the game's (`withGameMeta`), so
// what it stores of them may be out of date and is never written back just to match. A player joining the squad
// joins each set's list, which is otherwise the set's own, and a player the set has stats for stays in the squad.
// The next set carries the last one's video, and its lineup unless the game has a rotation to start from.

/** Whether two player or team names are the same, ignoring case and outer spaces. */
export const sameName = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The set's teams and date, from the game: the home side first. */
export function gameMeta(
  game: Pick<Game, "opponent" | "venue" | "date">,
  teamName: string
): Pick<MatchMeta, "homeTeam" | "awayTeam" | "date"> {
  const [homeTeam, awayTeam] = game.venue === "away" ? [game.opponent, teamName] : [teamName, game.opponent];

  return { homeTeam, awayTeam, date: game.date ?? "" };
}

/** The set with its teams and date taken from the game; the same object when they already match. */
export function withGameMeta(
  data: AppData,
  game: Pick<Game, "opponent" | "venue" | "date">,
  teamName: string
): AppData {
  const meta = gameMeta(game, teamName);
  const same = (Object.keys(meta) as (keyof typeof meta)[]).every((k) => data.meta[k] === meta[k]);

  return same ? data : { ...data, meta: { ...data.meta, ...meta } };
}

/** The players the set has stats for: in a touch or a substitution, or in its starting lineup or as its libero. */
export function playersWithStats(data: AppData): Set<string> {
  const named = new Set([...data.meta.lineup, data.meta.libero]);

  for (const e of data.events) {
    if (e.kind === "touch") named.add(e.player);
    if (e.kind === "sub") [e.in, e.out].forEach((p) => named.add(p));
  }
  named.delete("");

  return named;
}

/** Every name the set mentions: its player list and anyone it has stats for. */
export const setPlayerNames = (data: AppData): Set<string> => new Set([...data.players, ...playersWithStats(data)]);

/**
 * The set with players renamed (old name to new) everywhere it names them. A rename onto a name the set already
 * has would merge two players' stats, so callers check that first (see `renameClashes`).
 */
export function renamePlayers(data: AppData, renames: ReadonlyMap<string, string>): AppData {
  const names = setPlayerNames(data);

  if (![...renames].some(([from, to]) => from !== to && names.has(from))) return data;

  const name = (p: string) => renames.get(p) ?? p;

  return {
    ...data,
    players: [...new Set(data.players.map(name))],
    events: data.events.map((e) =>
      e.kind === "touch"
        ? { ...e, player: name(e.player) }
        : e.kind === "sub"
          ? { ...e, in: name(e.in), out: name(e.out) }
          : e
    ),
    meta: { ...data.meta, lineup: data.meta.lineup.map(name), libero: name(data.meta.libero) },
  };
}

/** Renames that would merge two players of the set: the new name is already one of its players. */
export function renameClashes(data: AppData, renames: ReadonlyMap<string, string>): string[] {
  const names = setPlayerNames(data);

  return [...renames]
    .filter(([from, to]) => from !== to && names.has(from) && [...names].some((n) => n !== from && sameName(n, to)))
    .map(([from]) => from);
}

/**
 * The set's player list after a squad change: the players in `added` (new to the squad) on it, and those in
 * `dropped` (taken out of the squad) off it unless the set has stats for them. The list is otherwise the set's
 * own, so a player taken off it in the tracker stays off. The same object when nothing changes.
 */
export function syncPlayers(data: AppData, added: readonly string[], dropped: readonly string[]): AppData {
  const kept = playersWithStats(data);
  const players = [
    ...data.players.filter((p) => !dropped.includes(p) || kept.has(p)),
    ...added.filter((p) => !data.players.includes(p)),
  ];

  return players.length === data.players.length && players.every((p, i) => p === data.players[i])
    ? data
    : { ...data, players };
}

/** Names that match a roster player only when ignoring case or spaces, to the roster's spelling. */
export function rosterSpellingsOf(names: Iterable<string>, roster: readonly RosterPlayer[]): Map<string, string> {
  return new Map(
    [...new Set(names)].flatMap((n) => {
      const p = roster.find((r) => sameName(r.name, n));

      return p && p.name !== n ? [[n, p.name] as const] : [];
    })
  );
}

/** The squad's names in squad order (by number, liberos last), as the tracker's players. */
export function squadNames(game: Pick<Game, "squad" | "overrides">, roster: readonly RosterPlayer[]): string[] {
  const players = playerMap(roster, game.overrides);

  return sortSquad(game.squad.flatMap((id) => players.get(id) ?? [])).map((p) => p.name);
}

/** The game's first rotation as a set's starting lineup, by name; null unless all six positions are filled. */
export function rotationLineup(
  game: Pick<Game, "rotations" | "overrides">,
  roster: readonly RosterPlayer[]
): Pick<MatchMeta, "lineup" | "libero"> | null {
  const rotation = game.rotations[0];
  const players = playerMap(roster, game.overrides);
  const name = (id: string | null) => (id && players.get(id)?.name) || "";
  const lineup = rotation?.positions.map(name) ?? [];

  return rotation && lineup.length === 6 && lineup.every(Boolean) ? { lineup, libero: name(rotation.libero) } : null;
}

/** A set starting from `lineup` (see rotationLineup), its players added to the set's when missing. */
export function withLineup(data: AppData, lineup: Pick<MatchMeta, "lineup" | "libero"> | null): AppData {
  if (!lineup) return data;

  const missing = [...lineup.lineup, lineup.libero].filter((p) => p && !data.players.includes(p));

  return { ...data, players: [...data.players, ...missing], meta: { ...data.meta, ...lineup } };
}

/**
 * A new set for the game, numbered `setNumber`. After an earlier set it keeps that set's lineup and video and
 * anyone added while tracking it; otherwise it starts from the squad. The game's first rotation, when it has
 * one, is every set's starting lineup instead.
 */
export function newSetData(
  game: Game,
  teamName: string,
  roster: readonly RosterPlayer[],
  setNumber: number,
  previous: AppData | null
): AppData {
  const base = previous ? nextSetData(previous) : emptyData();
  const squad = squadNames(game, roster);

  return withLineup(
    {
      ...base,
      players: [...squad, ...(previous?.players ?? []).filter((p) => !squad.includes(p))],
      meta: { ...base.meta, ...gameMeta(game, teamName), setNumber: String(setNumber) },
    },
    rotationLineup(game, roster)
  );
}

/** Sets of this game kept in this browser and not yet on the server, by set id. */
export function localSets(gameId: string): Map<string, Backup> {
  const found = new Map<string, Backup>();

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const id = key?.startsWith("volleyvector:set:") ? key.slice("volleyvector:set:".length) : null;
      const backup = id ? readBackup(localStorage, id) : null;

      if (id && backup?.gameId === gameId) found.set(id, backup);
    }
  } catch {
    // Storage blocked: nothing to list.
  }

  return found;
}
