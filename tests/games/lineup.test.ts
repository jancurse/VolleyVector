import { describe, expect, test } from "vitest";

import {
  assignLibero,
  assignPosition,
  createLineup,
  eligibleSubs,
  expectedRole,
  overviewZones,
  playerMap,
  rankForRole,
  setOverride,
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
  const game: Game = {
    id: "g",
    teamId: "t",
    name: "",
    date: null,
    squad: SQUAD.map((x) => x.id),
    overrides: {},
    overview: { print: false, shift: 0 },
    lineups: [lineup],
  };
  const next = setSquad(
    game,
    game.squad.filter((id) => id !== "s" && id !== "lib" && id !== "bench")
  ).lineups[0];

  expect(next.positions[0]).toBeNull();
  expect(next.libero).toBeNull();
  expect(next.alternates).toEqual({ oh1: [] });
});

describe("subs", () => {
  const lineup = toggleAlternate(createLineup(SQUAD, "Set 1"), "oh1", "bench");

  test("a player brought onto court stops being anyone's sub", () => {
    expect(assignPosition(lineup, 4, "bench").alternates).toEqual({ oh1: [] });
  });

  test("the libero stops being anyone's sub", () => {
    expect(assignLibero(lineup, "bench").alternates).toEqual({ oh1: [] });
  });

  test.each([
    ["oh1", []],
    ["oh2", ["bench"]],
  ])("only players off court, not the libero and not already listed, may sub for %s", (starter, ids) => {
    expect(eligibleSubs(lineup, starter, SQUAD).map((x) => x.id)).toEqual(ids);
  });
});

describe("expectedRole", () => {
  const lineup = createLineup(SQUAD, "Set 1");

  test.each([
    [0, "setter"],
    [2, "middle"],
    [3, "opposite"],
  ])("a 5-1 with the setter in I expects position %i to hold a %s", (index, role) => {
    expect(expectedRole(lineup, players, index)).toBe(role);
  });

  test.each([
    ["no setter on court", { ...lineup, positions: lineup.positions.map(() => null) }, "setter"],
    ["5-1 suggestions off", { ...lineup, fiveOne: false }, null],
  ])("with %s", (_, next, role) => {
    expect(expectedRole(next, players, 2)).toBe(role);
  });
});

test("rankForRole puts main fits first, then secondary, then everyone else", () => {
  const flex = { ...p("flex", 7, "outside"), secondary: "middle" as const };
  const { fits, canPlay, others } = rankForRole([...SQUAD, flex], "middle");

  expect(fits.map((x) => x.id)).toEqual(["mb1", "mb2"]);
  expect(canPlay.map((x) => x.id)).toEqual(["flex"]);
  expect(others).toHaveLength(6);
});

test("overviewZones lists each player at every position their main role holds", () => {
  const { zones, liberos } = overviewZones(SQUAD, 1);

  expect(zones.map((z) => z.map((x) => x.id))).toEqual([
    ["mb1", "mb2"],
    ["s"],
    ["oh1", "oh2", "bench"],
    ["mb1", "mb2"],
    ["opp"],
    ["oh1", "oh2", "bench"],
  ]);
  expect(liberos.map((x) => x.id)).toEqual(["lib"]);
});

describe("setOverride", () => {
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
  const setter = SQUAD[1];

  test.each([
    [{ number: 8 }, { s: { number: 8 } }],
    [{ number: 1, main: "opposite" as const }, { s: { main: "opposite" } }],
    [{ number: 1 }, {}],
  ])("keeps only what differs from the roster (%o)", (override, expected) => {
    expect(setOverride(game, setter, override).overrides).toEqual(expected);
  });

  test("applies to the game's player lookup", () => {
    expect(playerMap(SQUAD, { s: { number: 8 } }).get("s")?.number).toBe(8);
  });
});
