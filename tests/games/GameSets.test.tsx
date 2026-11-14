import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { GameSets } from "../../src/games/GameSets";
import { emptyData } from "../../src/stats/store";
import type { AppData, SetSummary } from "../../src/stats/types";
import { TooltipProvider } from "../../src/ui/Tooltip";

const SET: SetSummary = {
  id: "s1",
  gameId: "g",
  setNumber: 1,
  us: 25,
  them: 20,
  videoUrl: "https://youtu.be/abcdefghijk",
  touches: 66,
  finished: true,
  version: 2,
  statsSaved: true,
  unsavedStats: false,
  updatedAt: "2026-11-01T10:00:00Z",
  updatedBy: "Coach",
};

function renderSets(canEdit: boolean, error: string | null = null, data?: ReadonlyMap<string, AppData>) {
  const handlers = {
    onOpen: vi.fn(),
    onNew: vi.fn(() => Promise.resolve()),
    onDelete: vi.fn(),
    onImport: vi.fn(),
    onScore: vi.fn((_set: SetSummary, _score: { us: number; them: number }) => Promise.resolve<string | null>(null)),
    onReload: vi.fn(),
  };
  const local = new Map([
    ["s2", { gameId: "g", baseVersion: 0, data: { ...emptyData(), meta: { ...emptyData().meta, setNumber: "2" } } }],
  ]);

  render(
    <TooltipProvider>
      <GameSets sets={[SET]} local={local} loading={false} error={error} data={data} canEdit={canEdit} {...handlers} />
    </TooltipProvider>
  );

  return handlers;
}

describe("GameSets", () => {
  test("lists each set with its result, who saved it, and its video, plus a set kept only in this browser", () => {
    renderSets(true);

    expect(screen.getByText("Won 1–0")).toBeInTheDocument();
    expect(screen.getByText(/by Coach/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Watch/ })).toHaveAttribute("href", SET.videoUrl);
    expect(screen.getByText("Only in this browser: open it to save or discard it")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add set" })).toBeInTheDocument();
  });

  test.each([
    { name: "Record stats for set 1", handler: "onOpen" },
    { name: "Record stats for set 2", handler: "onOpen" },
    { name: "Delete set 1", handler: "onDelete" },
    { name: "Add set", handler: "onNew" },
  ] as const)("$name calls $handler", async ({ name, handler }) => {
    const handlers = renderSets(true);

    await userEvent.click(screen.getByRole("button", { name }));

    expect(handlers[handler]).toHaveBeenCalled();
  });

  test("the video link starts just before the set's first action", () => {
    const touch = (id: number, timestamp: number) =>
      ({ kind: "touch", id, timestamp, player: "A", stat: "serve", result: "in", zone: "" }) as const;

    renderSets(true, null, new Map([["s1", { ...emptyData(), events: [touch(1, 140), touch(2, 132.5)] }]]));

    expect(screen.getByRole("link", { name: /Watch/ })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=abcdefghijk&t=127s"
    );
  });

  test("a click on the score types it in; Escape cancels", async () => {
    const handlers = renderSets(true);

    await userEvent.click(screen.getByRole("button", { name: "Edit the score of set 1" }));
    await userEvent.keyboard("{Escape}");
    expect(handlers.onScore).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Edit the score of set 1" }));
    await userEvent.keyboard("25{Tab}23{Enter}");

    expect(handlers.onScore).toHaveBeenCalledWith(SET, { us: 25, them: 23 });
    expect(await screen.findByRole("button", { name: "Edit the score of set 1" })).toBeInTheDocument();
  });

  test("a score that fails to save stays open with the reason", async () => {
    const handlers = renderSets(true);

    handlers.onScore.mockResolvedValue("Couldn’t reach the server.");
    await userEvent.click(screen.getByRole("button", { name: "Edit the score of set 1" }));
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByText("Couldn’t reach the server.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Our points in set 1" })).toBeInTheDocument();
  });

  test("a score typed in over recorded stats is marked", () => {
    const touch = { kind: "touch", id: 1, timestamp: 1, player: "A", stat: "serve", result: "in", zone: "" } as const;

    renderSets(
      true,
      null,
      new Map([["s1", { ...emptyData(), events: [touch], meta: { ...emptyData().meta, score: { us: 25, them: 20 } } }]])
    );

    expect(screen.getByTitle("Typed in over the recorded stats")).toBeInTheDocument();
  });

  test("a failed load says so and starts no set, since the sets shown may be out of date", async () => {
    const handlers = renderSets(true, "Failed to fetch");

    expect(screen.getByText(/Couldn’t load the sets: Failed to fetch/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add set" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(handlers.onReload).toHaveBeenCalled();
  });

  test("a player sees the sets but cannot open, record, or delete them", () => {
    renderSets(false);

    expect(screen.queryByRole("button", { name: "Record stats for set 1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add set" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit the score of set 1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete set 1" })).not.toBeInTheDocument();
  });
});
