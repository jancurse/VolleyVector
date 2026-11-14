import { describe, expect, test } from "vitest";

import { clashingSets, gameName, groupImports, sideOf, withSide } from "../../src/stats/importSets";
import { emptyData } from "../../src/stats/store";

// Grouping imported set files into games.

const set = (home: string, away: string, date: string, setNumber: string, players: string[] = []) => {
  const data = emptyData(players);

  data.meta = { ...data.meta, homeTeam: home, awayTeam: away, date, setNumber };

  return { source: `${home}-${away}-${setNumber}.json`, data };
};

describe("import grouping", () => {
  test.each([
    { home: "Lynx", away: "Opal", team: "lynx", side: "home" },
    { home: "Opal", away: "Lynx ", team: "Lynx", side: "away" },
    { home: "Opal", away: "Pumas", team: "V3 Pumas", side: "away" },
    { home: "A", away: "B", team: "Lynx", side: "home" },
  ])("finds the team in $home v $away as $team: $side", ({ home, away, team, side }) => {
    expect(sideOf(set(home, away, "2026-11-01", "1").data, team)).toBe(side);
  });

  test("the other side is the opponent, and the game is named after both", () => {
    const [group] = groupImports([set("Opal", "Pumas", "2026-10-03", "1")], "V3 Pumas", []);

    expect(group).toMatchObject({ us: "away", opponent: "Opal", venue: "away" });
    expect(withSide(group!, "home")).toMatchObject({ us: "home", opponent: "Pumas", venue: "home" });
    expect(gameName(group!, "V3 Pumas")).toBe("Opal vs V3 Pumas");
  });

  test("groups sets by date and opponent, newest game first, sets in order", () => {
    const groups = groupImports(
      [
        set("Opal", "Lynx", "2026-10-10", "2", ["Mira", "Jo"]),
        set("Lynx", "Pumas", "2026-10-17", "1"),
        set("Opal", "Lynx", "2026-10-10", "1", ["Jo", "Suki"]),
      ],
      "Lynx",
      []
    );

    expect(groups.map((g) => [g.date, g.opponent, g.venue, g.sets.map((s) => s.data.meta.setNumber)])).toEqual([
      ["2026-10-17", "Pumas", "home", ["1"]],
      ["2026-10-10", "Opal", "away", ["1", "2"]],
    ]);
    expect(groups[1].players).toEqual(["Mira", "Jo", "Suki"]);
    expect(groups[1].gameId).toBeNull();
  });

  test("goes into an existing game with the same date and opponent, flagging set numbers it has", () => {
    const existing = { id: "g1", date: "2026-11-01", opponent: "opal", venue: "away" as const };
    const groups = groupImports(
      [set("Opal", "Lynx", "2026-11-01", "1"), set("Opal", "Lynx", "2026-11-01", "3")],
      "Lynx",
      [existing]
    );

    expect(groups[0].gameId).toBe("g1");
    expect(clashingSets(groups[0], (id) => (id === "g1" ? [1] : []))).toEqual([1]);
  });
});
