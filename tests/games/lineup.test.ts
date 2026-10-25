import { describe, expect, test } from "vitest";

import {
  assignLibero,
  assignPosition,
  createLineup,
  expectedRole,
  playerMap,
  rankForRole,
  setOverride,
  shiftPositions,
  toggleAlternate,
  versionLabel,
} from "../../src/games/lineup";
import type { Game, Position, RosterPlayer } from "../../src/games/types";

// The cases the game page tests cannot reach through the UI.

const p = (id: string, number: number, main: Position): RosterPlayer => ({
  id,
  number,
  name: id,
  main,
  secondary: null,
  archived: false,
});

const SQUAD = [
  p("oh2", 11, "outside"),
  p("s", 1, "setter"),
  p("oh1", 4, "outside"),
  p("mb1", 5, "middle"),
  p("mb2", 15, "middle"),
  p("opp", 9, "opposite"),
  p("lib", 2, "libero"),
  p("bench", 20, "outside"),
];
const players = playerMap(SQUAD);
const lineup = createLineup(SQUAD, "Set 1");

test("a new lineup leaves a position empty when the squad has no one for it", () => {
  expect(createLineup([p("s", 1, "setter")], "Set 1").positions).toEqual(["s", null, null, null, null, null]);
});

test("shiftPositions wraps around a full rotation", () => {
  expect(shiftPositions(["a", "b", "c", "d", "e", "f"], 6)).toEqual(["a", "b", "c", "d", "e", "f"]);
});

test.each([
  [0, "As entered"],
  [2, "Shifted 2"],
])("versionLabel falls back to the shift without a setter (%i)", (shift, label) => {
  expect(versionLabel({ ...lineup, positions: lineup.positions.map(() => null) }, players, shift)).toBe(label);
});

describe("subs", () => {
  const withSub = toggleAlternate(lineup, "oh1", "bench");

  test.each([
    ["a starter leaving the court takes their subs", assignPosition(withSub, 1, "bench"), {}],
    ["a sub brought onto court leaves every list", assignPosition(withSub, 4, "bench"), { oh1: [] }],
    ["the new libero leaves every list", assignLibero(withSub, "bench"), { oh1: [] }],
  ])("%s", (_, next, alternates) => {
    expect(next.alternates).toEqual(alternates);
  });

  test("moving the libero onto the court clears the libero slot", () => {
    expect(assignPosition(lineup, 5, "lib").libero).toBeNull();
  });
});

test("with no setter on court, every position asks for one", () => {
  expect(expectedRole({ ...lineup, positions: lineup.positions.map(() => null) }, players, 2)).toBe("setter");
});

test("rankForRole puts a player whose secondary position fits between the fits and the rest", () => {
  const flex = { ...p("flex", 7, "outside"), secondary: "middle" as const };

  expect(rankForRole([...SQUAD, flex], "middle").canPlay.map((x) => x.id)).toEqual(["flex"]);
});

test.each([
  [{ number: 1, main: "opposite" as const }, { s: { main: "opposite" } }],
  [{ number: 1 }, {}],
])("setOverride keeps only what differs from the roster (%o)", (override, expected) => {
  const game: Game = {
    id: "g",
    teamId: "t",
    name: "",
    date: null,
    squad: ["s"],
    overrides: {},
    overview: { print: false, shift: 0 },
    lineups: [],
  };

  expect(setOverride(game, SQUAD[1], override).overrides).toEqual(expected);
});
