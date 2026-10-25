import { createRotation } from "../../src/games/rotation";
import type { Game, Position, RosterPlayer } from "../../src/games/types";

// A 5-1 roster and a game built from it, shared by the games and print tests and the Supabase fake.

const player = (id: string, number: number, name: string, main: Position, shortName = ""): RosterPlayer => ({
  id,
  number,
  name,
  shortName,
  main,
  secondary: [],
  archived: false,
});

export const ROSTER: RosterPlayer[] = [
  player("p-s", 1, "Lena Vogt", "setter"),
  player("p-l", 2, "Tess Moor", "libero"),
  player("p-oh1", 4, "Mia Kraus", "outside"),
  player("p-mb1", 5, "Jana Weiss", "middle"),
  player("p-opp", 9, "Nora Falk", "opposite"),
  player("p-oh2", 11, "Sara Lind", "outside"),
  player("p-mb2", 15, "Ida Berg", "middle"),
  player("p-sub", 17, "Kim Roth", "outside", "Kim"),
];

export const GAME: Game = {
  id: "game-1",
  teamId: "test-team",
  name: "Cup final",
  date: "2026-10-31",
  squad: ROSTER.map((p) => p.id),
  overrides: {},
  overviewShift: 0,
  rotations: [
    {
      ...createRotation(ROSTER, "Set 1"),
      id: "rotation-1",
      alternates: { "p-oh2": ["p-sub"] },
      notes: "Serve short to their #8.",
    },
  ],
};
