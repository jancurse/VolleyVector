import { describe, expect, test } from "vitest";

import {
  assignPosition,
  createLineup,
  playerMap,
  setSquad,
  shiftPositions,
  toggleAlternate,
  versionLabel,
} from "../../src/games/lineup";
import type { Game, Position, RosterPlayer } from "../../src/games/types";

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

describe("createLineup", () => {
  test("fills a 5-1 in service order with the setter in I, lower numbers first", () => {
    const lineup = createLineup(SQUAD, "Set 1");

    expect(lineup.positions).toEqual(["s", "oh1", "mb1", "opp", "oh2", "mb2"]);
    expect(lineup.libero).toBe("lib");
    expect(lineup.printShifts).toEqual([0, 1]);
  });

  test("leaves a position empty when the squad has no one for it", () => {
    expect(createLineup([p("s", 1, "setter")], "Set 1").positions).toEqual(["s", null, null, null, null, null]);
  });
});

describe("shiftPositions", () => {
  test.each([
    [1, ["f", "a", "b", "c", "d", "e"]],
    [-1, ["b", "c", "d", "e", "f", "a"]],
    [6, ["a", "b", "c", "d", "e", "f"]],
  ])("shifts by %i", (steps, expected) => {
    expect(shiftPositions(["a", "b", "c", "d", "e", "f"], steps)).toEqual(expected);
  });
});

describe("versionLabel", () => {
  const lineup = createLineup(SQUAD, "Set 1");

  test.each([
    [0, "Setter in I"],
    [1, "Setter in II"],
    [5, "Setter in VI"],
  ])("names shift %i by the setter's position", (shift, label) => {
    expect(versionLabel(lineup, players, shift)).toBe(label);
  });

  test.each([
    [0, "As entered"],
    [2, "Shifted 2"],
  ])("falls back to the shift without a setter (%i)", (shift, label) => {
    expect(versionLabel({ ...lineup, positions: lineup.positions.map(() => null) }, players, shift)).toBe(label);
  });
});

describe("assignPosition", () => {
  const lineup = toggleAlternate(createLineup(SQUAD, "Set 1"), "oh2", "bench");

  test("swaps a player already on court with the occupant", () => {
    expect(assignPosition(lineup, 0, "opp").positions).toEqual(["opp", "oh1", "mb1", "s", "oh2", "mb2"]);
  });

  test("drops the alternates of a starter who leaves the court", () => {
    expect(assignPosition(lineup, 4, "bench").alternates).toEqual({});
  });

  test("moves the libero onto the court and clears the libero slot", () => {
    const next = assignPosition(lineup, 5, "lib");

    expect(next.positions[5]).toBe("lib");
    expect(next.libero).toBeNull();
  });
});

test("toggleAlternate adds then removes", () => {
  const lineup = createLineup(SQUAD, "Set 1");
  const added = toggleAlternate(lineup, "oh1", "bench");

  expect(added.alternates).toEqual({ oh1: ["bench"] });
  expect(toggleAlternate(added, "oh1", "bench").alternates).toEqual({ oh1: [] });
});

test("setSquad removes dropped players from every lineup", () => {
  const lineup = toggleAlternate(createLineup(SQUAD, "Set 1"), "oh1", "bench");
  const game: Game = { id: "g", teamId: "t", name: "", date: null, squad: SQUAD.map((x) => x.id), lineups: [lineup] };
  const next = setSquad(
    game,
    game.squad.filter((id) => id !== "s" && id !== "lib" && id !== "bench")
  ).lineups[0];

  expect(next.positions[0]).toBeNull();
  expect(next.libero).toBeNull();
  expect(next.alternates).toEqual({ oh1: [] });
});
