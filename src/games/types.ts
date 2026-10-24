import type { MarkerRole } from "../court/roles";

/** A playing position a roster player can hold: the volleyball marker roles. */
export type Position = Extract<MarkerRole, "setter" | "outside" | "middle" | "opposite" | "libero">;

export const POSITIONS: readonly Position[] = ["setter", "outside", "middle", "opposite", "libero"];

export type RosterPlayer = {
  id: string;
  number: number;
  name: string;
  main: Position;
  secondary: Position | null;
  /** A removed player stays resolvable, so games that include them keep their number and name. */
  archived: boolean;
};

/** A one-game change to a roster player's number or positions, leaving the roster itself untouched. */
export type PlayerOverride = Partial<Pick<RosterPlayer, "number" | "main" | "secondary">>;

/** One starting lineup of a game. */
export type Lineup = {
  id: string;
  name: string;
  /** The six starters by official position: index 0 is position I, index 5 is position VI. */
  positions: (string | null)[];
  libero: string | null;
  /** Possible substitutes, keyed by the starter each may replace. */
  alternates: Record<string, string[]>;
  notes: string;
  /** The rotated versions to print, each as a shift: how many positions every player moves up (I → II). */
  printShifts: number[];
  /** Whether the player pickers suggest players for each position by a 5-1 around the setter. */
  fiveOne: boolean;
};

/** The game's overview slip: every squad player at their position, rotated by `shift`. */
export type Overview = { print: boolean; shift: number };

/** A game: a lightweight named plan holding the squad picked from the roster and its starting lineups. */
export type Game = {
  id: string;
  teamId: string;
  name: string;
  /** An ISO date (YYYY-MM-DD), or null for a general plan with no fixture. */
  date: string | null;
  /** The roster player ids picked for this game. */
  squad: string[];
  /** One-game changes to squad players, by player id. */
  overrides: Record<string, PlayerOverride>;
  overview: Overview;
  lineups: Lineup[];
};
