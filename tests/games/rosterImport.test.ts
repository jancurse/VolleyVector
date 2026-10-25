import { expect, test } from "vitest";

import { parseRoster } from "../../src/games/rosterImport";
import type { RosterPlayer } from "../../src/games/types";

const ROSTER: RosterPlayer[] = [
  { id: "a", number: 7, name: "Ana", main: "setter", secondary: null, archived: false },
  { id: "b", number: 9, name: "Gone", main: "middle", secondary: null, archived: true },
];

test.each([
  ["comma, with a header", "number,name,main,secondary\n12,Cleo,OH,mb"],
  ["tab, from a spreadsheet", "12\tCleo\toutside hitter\tMiddle"],
  ["semicolon", "12;Cleo;outside;MB"],
])("reads a %s", (_, text) => {
  expect(parseRoster(text, ROSTER)).toEqual([
    {
      line: expect.any(Number),
      text: expect.any(String),
      draft: { number: 12, name: "Cleo", main: "outside", secondary: "middle" },
    },
  ]);
});

test.each([
  ["7,Dup,S", "#7 is already taken"],
  ["100,Big,S", "Number must be 0–99"],
  ["5,,S", "Name is missing"],
  ["5,Eve,coach", "Unknown main position “coach”"],
  ["5,Eve,S,goalie", "Unknown secondary position “goalie”"],
  ["#12,Cleo,OH", "Number must be 0–99"],
])("skips %s with a reason", (text, error) => {
  expect(parseRoster(text, ROSTER)).toEqual([{ line: 1, text, error }]);
});

test("frees an archived player's number and rejects a number repeated in the file", () => {
  expect(parseRoster("9,New,L\n9,Twin,L", ROSTER).map((r) => ("error" in r ? r.error : r.draft.name))).toEqual([
    "New",
    "#9 is already taken",
  ]);
});

test("keeps the delimiter inside a quoted name", () => {
  expect(parseRoster('12,"Vogt, ""Lena""",S', ROSTER)).toMatchObject([{ draft: { name: 'Vogt, "Lena"' } }]);
});
