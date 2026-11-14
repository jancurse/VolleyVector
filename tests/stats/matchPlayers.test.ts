import { describe, expect, test } from "vitest";

import { rosterSpellingsOf } from "../../src/stats/gameSets";
import {
  choiceProblems,
  choiceRenames,
  defaultChoices,
  matchable,
  newPlayers,
  unmatchedNames,
} from "../../src/stats/matchPlayers";
import type { PlayerChoice } from "../../src/stats/matchPlayers";
import { emptyData } from "../../src/stats/store";
import { ROSTER } from "../helpers/gameData";

const roster = ROSTER.slice(0, 3); // #1 Lena Vogt, #2 Tess Moor, #4 Mia Kraus
const sets = [emptyData(["lena vogt", "Lena", "Tess Moor"]), emptyData(["Kim", "Guest"])];

describe("linking set players to the roster", () => {
  test("names off the roster need a choice; others take the roster's spelling", () => {
    const names = sets.flatMap((s) => s.players);

    expect(unmatchedNames(names, roster)).toEqual(["Lena", "Kim", "Guest"]);
    expect(rosterSpellingsOf(names, roster)).toEqual(new Map([["lena vogt", "Lena Vogt"]]));
    expect(defaultChoices(["Kim", "Guest"], roster)).toEqual({
      Kim: { kind: "add", number: "0", main: "outside" },
      Guest: { kind: "add", number: "3", main: "outside" },
    });
  });

  test("a name added later is numbered after the choices already kept", () => {
    const kept = defaultChoices(["Kim"], roster);

    expect(defaultChoices(["Guest", "Kim"], roster, kept)).toEqual({
      Guest: { kind: "add", number: "3", main: "outside" },
      Kim: { kind: "add", number: "0", main: "outside" },
    });
  });

  test("a name is never matched to someone in the same set", () => {
    expect(matchable("Lena", sets, roster).map((p) => p.name)).toEqual(["Mia Kraus"]);
    expect(matchable("Kim", sets, roster)).toHaveLength(3);
  });

  test.each<{ choices: Record<string, PlayerChoice>; problem: RegExp }>([
    { choices: { Kim: { kind: "add", number: "4", main: "outside" } }, problem: /Number 4 is taken/ },
    { choices: { Kim: { kind: "add", number: "", main: "outside" } }, problem: /needs a number/ },
    {
      choices: { Kim: { kind: "same", playerId: "p-l" }, Guest: { kind: "same", playerId: "p-l" } },
      problem: /twice/,
    },
    { choices: { Lena: { kind: "same", playerId: "p-s" } }, problem: /twice/ },
  ])("refuses $problem", ({ choices, problem }) => {
    expect(choiceProblems(choices, sets, roster).join(" ")).toMatch(problem);
  });

  test("valid choices add some players and rename the others", () => {
    const choices: Record<string, PlayerChoice> = {
      Kim: { kind: "same", playerId: "p-oh1" },
      Guest: { kind: "add", number: "7", main: "middle" },
    };

    expect(choiceProblems(choices, sets, roster)).toEqual([]);
    expect(newPlayers(choices)).toEqual([{ number: 7, name: "Guest", shortName: "", main: "middle", secondary: [] }]);
    expect(choiceRenames(choices, roster)).toEqual(new Map([["Kim", "Mia Kraus"]]));
  });
});
