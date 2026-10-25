import type { MarkerRole } from "../court/roles";

export type Position = Extract<MarkerRole, "setter" | "outside" | "middle" | "opposite" | "libero">;

export const POSITIONS: readonly Position[] = ["setter", "outside", "middle", "opposite", "libero"];

export type RosterPlayer = {
  id: string;
  number: number;
  name: string;
  /** The name on the slips; empty means the full name. */
  shortName: string;
  main: Position;
  secondary: Position[];
  /** A removed player stays resolvable, so games that include them keep their number and name. */
  archived: boolean;
};

export type PlayerOverride = Partial<Pick<RosterPlayer, "number" | "main" | "secondary">>;

export type Rotation = {
  id: string;
  name: string;
  /** The six starters by official position: index 0 is position I, index 5 is position VI. */
  positions: (string | null)[];
  libero: string | null;
  /** Keyed by the starter each may replace. */
  alternates: Record<string, string[]>;
  notes: string;
  /** The rotated versions to print, each as a shift: how many positions every player moves up (I → II). */
  printShifts: number[];
  fiveOne: boolean;
};

export type Game = {
  id: string;
  teamId: string;
  name: string;
  /** An ISO date (YYYY-MM-DD), or null for a general plan with no fixture. */
  date: string | null;
  squad: string[];
  overrides: Record<string, PlayerOverride>;
  overviewShift: number;
  rotations: Rotation[];
};
