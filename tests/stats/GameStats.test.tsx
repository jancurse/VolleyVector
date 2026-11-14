import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { formatGameDate } from "../../src/games/format";
import { GameStats } from "../../src/stats/GameStats";
import { emptyData } from "../../src/stats/store";
import type { AppData } from "../../src/stats/types";
import { TooltipProvider } from "../../src/ui/Tooltip";
import { GAME, ROSTER } from "../helpers/gameData";

vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

const loaded = vi.hoisted(() => ({ sets: [] as { gameId: string; data: unknown }[], error: null as string | null }));

vi.mock("../../src/stats/sets", async (original) => ({
  ...(await original<typeof import("../../src/stats/sets")>()),
  loadGameSets: async () => ({ sets: loaded.sets, error: loaded.error }),
}));

/** A set whose stats name `players`, each serving an ace, stored with out-of-date teams and date. */
const statsOf = (players: string[]): AppData => ({
  ...emptyData(players),
  meta: { ...emptyData().meta, setNumber: "1", homeTeam: "Old name", awayTeam: "Old opponent", date: "2026-01-01" },
  events: players.map((player, i) => ({
    kind: "touch",
    id: i + 1,
    timestamp: i + 1,
    player,
    stat: "serve",
    result: "ace",
    zone: "1",
  })),
});

function renderStats(sets: AppData[], error: string | null = null) {
  loaded.sets = sets.map((data) => ({ gameId: GAME.id, data }));
  loaded.error = error;
  render(
    <TooltipProvider>
      <GameStats
        gameIds={[GAME.id]}
        games={[GAME]}
        teamName="Eagles"
        roster={ROSTER}
        initialTab="stats"
        onTab={() => {}}
      />
    </TooltipProvider>
  );
}

describe("GameStats", () => {
  test.each([
    { sets: [], error: null, message: "No stats saved yet." },
    { sets: [statsOf(["Lena Vogt"])], error: "Failed to fetch", message: "Couldn’t load the sets: Failed to fetch" },
  ])("shows $message", async ({ sets, error, message }) => {
    renderStats(sets, error);

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  test("shows the saved stats with the game's teams and date", async () => {
    renderStats([statsOf(["Lena Vogt"])]);

    expect(await screen.findByRole("heading", { name: "Cup final" })).toBeInTheDocument();
    expect(screen.getByText("Eagles, 1 set")).toBeInTheDocument();
    expect(screen.getByText(formatGameDate("2026-10-31"))).toBeInTheDocument();
    expect(screen.queryByText(/Old opponent/)).not.toBeInTheDocument();
  });

  test.each([
    { players: ["lena vogt"], shown: "Lena Vogt", hidden: "lena vogt" },
    // Respelling would merge two of the set's players into one, so the set keeps its own spellings.
    { players: ["lena vogt", "Lena Vogt"], shown: "lena vogt", hidden: "" },
  ])("spells $players as the roster does unless that merges players", async ({ players, shown, hidden }) => {
    renderStats([statsOf(players)]);

    const log = await screen.findByRole("table", { name: "Rally log" });

    expect(log).toHaveTextContent(shown);
    if (hidden) expect(log).not.toHaveTextContent(hidden);
  });
});
