import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { deriveRallies } from "../../src/stats/rallies";
import { StatsPage } from "../../src/stats/StatsPage";
import { emptyData } from "../../src/stats/store";
import type { MatchEvent, ReportSet, Skill } from "../../src/stats/types";
import { TooltipProvider } from "../../src/ui/Tooltip";

let id = 1;
const touch = (timestamp: number, player: string, stat: Skill, result: string, zone = "1"): MatchEvent => ({
  kind: "touch",
  id: id++,
  timestamp,
  player,
  stat,
  result,
  zone,
});

const set = (n: string, events: MatchEvent[]): ReportSet => {
  const meta = { ...emptyData().meta, setNumber: n, homeTeam: "Eagles", awayTeam: "Riverside", date: "2026-11-01" };

  return { meta, rallies: deriveRallies(events, meta) };
};

const SETS = [
  set("1", [
    touch(1, "Mira", "serve", "dig23"),
    touch(4, "Ana", "set", "on", "4"),
    touch(5, "Suki", "attack", "kill", "5"),
  ]),
  set("2", [touch(1, "Mira", "serve", "out", "0"), touch(20, "Suki", "receive", "dig01", "6")]),
];

function renderPage() {
  render(
    <TooltipProvider>
      <StatsPage sets={SETS} eyebrow="Eagles" title="Cup final" initialTab="stats" />
    </TooltipProvider>
  );
}

describe("StatsPage", () => {
  test("shows each set's score and every panel of the stats", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Cup final" })).toBeInTheDocument();
    // One page title: the dashboard's own title is only for its exported page.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("1 November 2026")).toBeInTheDocument();

    for (const name of [
      "Point breakdown",
      "Rotations",
      "Momentum",
      "Playing time",
      "Score progression",
      "Zones",
      "Player metrics",
      "Player detail",
    ])
      expect(screen.getByRole("region", { name })).toBeInTheDocument();

    expect(screen.getByRole("table", { name: "Rally log" })).toHaveTextContent("Suki");
  });

  test("picking a set narrows the rally log to it", async () => {
    renderPage();

    const log = screen.getByRole("table", { name: "Rally log" });

    expect(log).toHaveTextContent("Ana");

    await userEvent.click(within(screen.getByRole("group", { name: "Set" })).getByRole("button", { name: "Set 2" }));

    expect(log).not.toHaveTextContent("Ana");
    expect(log).toHaveTextContent("MiraServeOut");
  });

  test("picking a player in the grid shows their metrics", async () => {
    renderPage();

    await userEvent.click(
      within(screen.getByRole("region", { name: "Player metrics" })).getByRole("button", { name: "Mira" })
    );

    expect(screen.getByRole("heading", { name: "Metrics and zones: Mira" })).toBeInTheDocument();
  });

  test.each([
    { tab: "Highlights", shows: "Pick filters, then press Play all" },
    { tab: "Match report", shows: "Download PDF" },
  ])("the $tab tab opens", async ({ tab, shows }) => {
    renderPage();

    await userEvent.click(screen.getByRole("tab", { name: tab }));

    expect(await screen.findByText(shows)).toBeInTheDocument();
  });
});
