import { describe, expect, test } from "vitest";

import { versus } from "../../src/games/format";
import {
  gameMeta,
  newSetData,
  playersWithStats,
  renameClashes,
  renamePlayers,
  squadNames,
  syncPlayers,
  withGameMeta,
} from "../../src/stats/gameSets";
import { emptyData } from "../../src/stats/store";
import type { AppData } from "../../src/stats/types";
import { GAME, ROSTER } from "../helpers/gameData";

describe("a game's sets", () => {
  test.each([
    { venue: "home" as const, home: "Eagles", away: "Riverside", label: "vs Riverside" },
    { venue: "away" as const, home: "Riverside", away: "Eagles", label: "at Riverside" },
    { venue: "neutral" as const, home: "Eagles", away: "Riverside", label: "vs Riverside (neutral)" },
  ])("take their teams and date from the game ($venue)", ({ venue, home, away, label }) => {
    expect(gameMeta({ ...GAME, venue }, "Eagles")).toEqual({ homeTeam: home, awayTeam: away, date: "2026-10-31" });
    expect(versus("Riverside", venue)).toBe(label);
  });

  test("the game's details replace a set's, leaving the set untouched when they match", () => {
    const set = emptyData(["Mira"]);
    const fixed = withGameMeta(set, GAME, "Eagles");

    expect(fixed.meta).toMatchObject({ homeTeam: "Eagles", awayTeam: "Riverside", date: "2026-10-31" });
    expect(withGameMeta(fixed, GAME, "Eagles")).toBe(fixed);
  });

  test("a first set starts from the squad in squad order; the next keeps the last set's lineup and extras", () => {
    const squad = squadNames(GAME, ROSTER);
    const first = newSetData(GAME, "Eagles", squad, 1, null);

    expect(first.players).toEqual(squad);
    expect(first.meta).toMatchObject({ setNumber: "1", homeTeam: "Eagles", awayTeam: "Riverside" });
    expect(squad.at(-1)).toBe(ROSTER.find((p) => p.main === "libero")?.name);

    const played = {
      ...first,
      players: [...first.players, "Guest"],
      meta: { ...first.meta, youtubeUrl: "https://youtu.be/abcdefghijk", lineup: squad.slice(0, 6), libero: "" },
    };
    const second = newSetData(GAME, "Eagles", squad, 2, played);

    expect(second.players).toEqual([...squad, "Guest"]);
    expect(second.events).toEqual([]);
    expect(second.meta).toMatchObject({
      setNumber: "2",
      youtubeUrl: "https://youtu.be/abcdefghijk",
      lineup: squad.slice(0, 6),
    });
  });
});

const recorded = (players: string[]): AppData => ({
  ...emptyData(players),
  events: [
    { kind: "touch", id: 1, timestamp: 1, player: "Jo", stat: "serve", result: "ace", zone: "1" },
    { kind: "sub", id: 2, timestamp: 2, out: "Jo", in: "Mira" },
  ],
  meta: { ...emptyData().meta, lineup: ["Jo", "A", "B", "C", "D", "E"], libero: "Jo" },
});

describe("keeping a set in line with its game", () => {
  test("a rename reaches every place the set names the player", () => {
    const renamed = renamePlayers(recorded(["Jo", "Mira"]), new Map([["Jo", "Joanna"]]));

    expect(renamed.players).toEqual(["Joanna", "Mira"]);
    expect(renamed.events).toMatchObject([{ player: "Joanna" }, { out: "Joanna", in: "Mira" }]);
    expect(renamed.meta).toMatchObject({ lineup: ["Joanna", "A", "B", "C", "D", "E"], libero: "Joanna" });
    expect(playersWithStats(renamed)).toEqual(new Set(["Joanna", "Mira", "A", "B", "C", "D", "E"]));
  });

  test("a rename onto a player the set already has is a clash, and an unrelated one changes nothing", () => {
    const set = recorded(["Jo", "Mira"]);

    expect(renameClashes(set, new Map([["Jo", "Mira"]]))).toEqual(["Jo"]);
    expect(renamePlayers(set, new Map([["Ana", "Anna"]]))).toBe(set);
  });

  test("the squad joins the set's list, and a dropped player leaves it only without stats", () => {
    const set = recorded(["Jo", "Mira", "Guest", "Sam"]);
    const synced = syncPlayers(set, ["Jo", "Nina"], ["Mira", "Sam"]);

    expect(synced.players).toEqual(["Jo", "Mira", "Guest", "Nina"]);
    expect(synced.meta).toBe(set.meta);
    expect(syncPlayers(synced, ["Jo", "Nina"], ["Mira", "Sam"])).toBe(synced);
  });
});
