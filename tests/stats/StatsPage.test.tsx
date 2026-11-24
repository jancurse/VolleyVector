import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { formatGameDate } from "../../src/games/format";
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

const set = (n: string, events: MatchEvent[], awayTeam = "Riverside"): ReportSet => {
  const meta = { ...emptyData().meta, setNumber: n, homeTeam: "Eagles", awayTeam, date: "2026-11-01" };

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

const page = (props: Partial<ComponentProps<typeof StatsPage>>) => (
  <TooltipProvider>
    <StatsPage sets={SETS} eyebrow="Eagles" title="Cup final" initialTab="stats" {...props} />
  </TooltipProvider>
);

const renderPage = (props: Partial<ComponentProps<typeof StatsPage>> = {}) => render(page(props));

const clipRows = async () => {
  const clips = within(await screen.findByRole("region", { name: "Clips" }));

  return () => clips.getAllByRole("listitem").map((li) => li.textContent);
};

beforeEach(() => localStorage.clear());

describe("StatsPage", () => {
  test("shows each set's score and every panel of the stats", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Cup final" })).toBeInTheDocument();
    // One page title: the dashboard's own title is only for its exported page.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText(formatGameDate("2026-11-01"))).toBeInTheDocument();

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

  test("the highlights list the clips, narrow by filter, and mark the clip picked", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("tab", { name: "Highlights" }));

    const clips = within(await screen.findByRole("region", { name: "Clips" }));
    const rows = await clipRows();

    expect(rows()).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Focus mode" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Players" }));
    await userEvent.click(screen.getByRole("button", { name: "Player Suki" }));
    await userEvent.keyboard("{Escape}");

    expect(screen.getByRole("button", { name: "Players Suki" })).toBeInTheDocument();
    expect(rows()).toEqual([expect.stringContaining("Suki · Attack Kill"), expect.stringContaining("Suki · Receive")]);

    await userEvent.click(clips.getByRole("button", { name: /Suki · Receive/ }));

    expect(clips.getAllByRole("listitem")[1]).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("This set has no YouTube link.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    await userEvent.click(screen.getByRole("button", { name: "Action" }));
    await userEvent.click(screen.getByRole("button", { name: "Action Serve" }));
    await userEvent.click(screen.getByRole("button", { name: "Serve, Out, loses the point" }));
    await userEvent.keyboard("{Escape}");

    expect(screen.getByRole("button", { name: "Action Serve: Out" })).toBeInTheDocument();
    expect(rows()).toEqual([expect.stringContaining("Mira · Serve Out")]);

    await userEvent.click(screen.getByRole("button", { name: "Clear action" }));
    await userEvent.click(screen.getByRole("button", { name: "Won" }));

    expect(rows()).toEqual([expect.stringContaining("Suki · Attack Kill")]);
  });

  test("the games filter picks a whole match or one of its sets", async () => {
    const riverside = `Eagles vs Riverside, ${formatGameDate("2026-11-01")}`;

    renderPage({ sets: [...SETS, set("1", [touch(1, "Ana", "serve", "ace")], "Pumas")], initialTab: "highlights" });

    const rows = await clipRows();

    expect(rows()).toHaveLength(4);

    await userEvent.click(screen.getByRole("button", { name: "Games" }));
    await userEvent.click(screen.getByRole("button", { name: `Match ${riverside}` }));

    expect(screen.getByRole("button", { name: `Games ${riverside}` })).toBeInTheDocument();
    expect(rows()).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: `${riverside} Set 2` }));

    expect(screen.getByRole("button", { name: `Match ${riverside}` })).toHaveAttribute("aria-pressed", "mixed");
    expect(screen.getByRole("button", { name: `Games ${riverside} S1` })).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Clear games" }));

    expect(rows()).toHaveLength(4);
  });

  test("the zone filter narrows to a zone and draws the court its actions land on", async () => {
    renderPage({ initialTab: "highlights" });

    const rows = await clipRows();

    await userEvent.click(screen.getByRole("button", { name: "Zone" }));

    expect(screen.getByText("A zone means what its action recorded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zone Z9" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Zone Z5" }));
    await userEvent.keyboard("{Escape}");

    expect(screen.getByRole("button", { name: "Zone Z5" })).toBeInTheDocument();
    expect(rows()).toEqual([expect.stringContaining("Suki · Attack Kill")]);

    await userEvent.click(screen.getByRole("button", { name: "Clear zone" }));
    await userEvent.click(screen.getByRole("button", { name: "Action" }));
    await userEvent.click(screen.getByRole("button", { name: "Action Serve" }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Zone" }));

    expect(screen.getByText("Their court, seen from ours")).toBeInTheDocument();
    expect(screen.getByText("Where the serve went")).toBeInTheDocument();
  });

  test("filling the window, the highlights move the clips and switch focus mode by button and key", async () => {
    const onFocus = vi.fn();
    const { rerender } = renderPage({ initialTab: "highlights", fill: true, onFocus });

    await userEvent.click(await screen.findByRole("button", { name: "Put the clips under the video" }));

    expect(JSON.parse(localStorage.getItem("volleyvector:highlights:layout") ?? "{}")).toMatchObject({
      place: "below",
    });

    await userEvent.keyboard("x");

    expect(screen.getByRole("button", { name: "Put the clips under the video" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Focus mode" }));
    await userEvent.keyboard("v");

    expect(onFocus.mock.calls).toEqual([[true], [true]]);

    rerender(page({ initialTab: "highlights", fill: true, onFocus, focus: true }));

    expect(screen.queryByRole("heading", { name: "Cup final" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: "View" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Clips" })).toBeInTheDocument();
  });

  test.each([
    { key: "f", shows: () => expect(screen.getByRole("dialog", { name: "Games" })).toBeInTheDocument() },
    {
      key: "l",
      shows: () =>
        expect(screen.getByRole("button", { name: "Loop the clip" })).toHaveAttribute("aria-pressed", "true"),
    },
    {
      key: "]",
      shows: () => expect(screen.getByRole("combobox", { name: "Playback speed" })).toHaveTextContent("1.5×"),
    },
    {
      key: "{ArrowDown}",
      shows: () => expect(screen.getAllByRole("listitem")[0]).toHaveAttribute("aria-current", "true"),
    },
  ])("the highlights answer the $key key", async ({ key, shows }) => {
    renderPage();
    await userEvent.click(screen.getByRole("tab", { name: "Highlights" }));
    await screen.findByRole("region", { name: "Clips" });
    await userEvent.keyboard(key);

    shows();
  });

  test("hidden but kept mounted, the highlights ignore their keys", async () => {
    renderPage({ initialTab: "highlights", active: false });
    await screen.findByRole("region", { name: "Clips" });
    await userEvent.keyboard("l");

    expect(screen.getByRole("button", { name: "Loop the clip" })).toHaveAttribute("aria-pressed", "false");
  });
});
