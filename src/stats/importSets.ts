import type { Game, Venue } from "../games/types";
import { gameMeta, sameName as same } from "./gameSets";
import type { AppData } from "./types";

// Exported set files grouped into games. A group is the sets that share a date and teams. Which side is the team is guessed
// from its name, and the group goes into an existing game with the same date and opponent, or a new one,
// whose name, date, opponent, and venue come from the files. Everything is a suggestion the import dialog
// lets the coach change.

export type Side = "home" | "away";

export type ImportedSet = {
  /** The file it came from. */
  source: string;
  data: AppData;
};

export type ImportGroup = {
  key: string;
  /** The teams as the files name them. */
  home: string;
  away: string;
  /** Which of the files' teams is the team. */
  us: Side;
  /** The game's name; null to follow the team, opponent, and venue. */
  name: string | null;
  date: string;
  opponent: string;
  venue: Venue;
  /** The existing game to add the sets to, or null for a new game. */
  gameId: string | null;
  sets: ImportedSet[];
  /** Every player named in the sets, in order of appearance. */
  players: string[];
};

const within = (a: string, b: string): boolean =>
  !!a.trim() &&
  !!b.trim() &&
  (b.toLowerCase().includes(a.trim().toLowerCase()) || a.toLowerCase().includes(b.trim().toLowerCase()));

/** Which side the team is on, judging by the team names in a set: the same name, else one inside the other. */
export function sideOf(data: AppData, teamName: string): Side {
  const { homeTeam, awayTeam } = data.meta;

  if (same(homeTeam, teamName)) return "home";
  if (same(awayTeam, teamName)) return "away";

  return within(awayTeam, teamName) && !within(homeTeam, teamName) ? "away" : "home";
}

/** The group with the team on side `us`: the other side is the opponent, and the venue follows. */
export function withSide(group: ImportGroup, us: Side): ImportGroup {
  return { ...group, us, opponent: (us === "home" ? group.away : group.home).trim(), venue: us };
}

/** A game's name: the home and away teams, as "Opal vs Eagles". The date has its own column, so it stays out. */
export function gameName(game: Pick<Game, "opponent" | "venue" | "date">, teamName: string): string {
  const { homeTeam, awayTeam } = gameMeta(game, teamName);

  if (!game.opponent) return "Imported game";

  return `${homeTeam} vs ${awayTeam}`;
}

/** A set's number, or 0 when its file gives none. */
export const setNumberOf = (data: AppData): number => parseInt(data.meta.setNumber, 10) || 0;

export function groupImports(
  sets: readonly ImportedSet[],
  teamName: string,
  games: readonly Pick<Game, "id" | "date" | "opponent" | "venue">[]
): ImportGroup[] {
  const groups = new Map<string, ImportGroup>();

  for (const set of sets) {
    const { homeTeam: home, awayTeam: away, date } = set.data.meta;
    const key = `${date}|${home.trim().toLowerCase()}|${away.trim().toLowerCase()}`;
    let group = groups.get(key);

    if (!group) {
      const sided = withSide(
        {
          key,
          home,
          away,
          us: "home",
          name: null,
          date,
          opponent: "",
          venue: "home",
          gameId: null,
          sets: [],
          players: [],
        },
        sideOf(set.data, teamName)
      );
      const existing = games.find((g) => g.date === date && same(g.opponent, sided.opponent));

      group = { ...sided, venue: existing?.venue ?? sided.venue, gameId: existing?.id ?? null };
      groups.set(key, group);
    }

    group.sets.push(set);
    for (const p of set.data.players) if (!group.players.includes(p)) group.players.push(p);
  }

  for (const g of groups.values()) g.sets.sort((a, b) => setNumberOf(a.data) - setNumberOf(b.data));

  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/** Set numbers in `group` that its target game already has. */
export function clashingSets(group: ImportGroup, existingSetNumbers: (gameId: string) => readonly number[]): number[] {
  if (!group.gameId) return [];

  const have = new Set(existingSetNumbers(group.gameId));

  return group.sets.map((s) => setNumberOf(s.data)).filter((n) => have.has(n));
}

/** A game just created, with no opponent and no sets yet: importing into it fills it in from the files. */
export const isBlankGame = (game: Pick<Game, "opponent">, setCount: number): boolean =>
  !game.opponent && setCount === 0;
