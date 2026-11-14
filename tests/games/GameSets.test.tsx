import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { GameSets } from "../../src/games/GameSets";
import { emptyData } from "../../src/stats/store";
import type { SetSummary } from "../../src/stats/types";
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
  updatedAt: "2026-11-01T10:00:00Z",
  updatedBy: "Coach",
};

function renderSets(canEdit: boolean, error: string | null = null) {
  const handlers = {
    onOpen: vi.fn(),
    onNew: vi.fn(),
    onDelete: vi.fn(),
    onImport: vi.fn(),
    onStats: vi.fn(),
    onReload: vi.fn(),
  };
  const local = new Map([
    ["s2", { gameId: "g", baseVersion: 0, data: { ...emptyData(), meta: { ...emptyData().meta, setNumber: "2" } } }],
  ]);

  render(
    <TooltipProvider>
      <GameSets sets={[SET]} local={local} loading={false} error={error} canEdit={canEdit} {...handlers} />
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
    expect(screen.getByRole("button", { name: "Next set" })).toBeInTheDocument();
  });

  test.each([
    { name: "Open set 1", handler: "onOpen" },
    { name: "Open set 2", handler: "onOpen" },
    { name: "Delete set 1", handler: "onDelete" },
    { name: "Stats and highlights", handler: "onStats" },
  ] as const)("$name calls $handler", async ({ name, handler }) => {
    const handlers = renderSets(true);

    await userEvent.click(screen.getByRole("button", { name }));

    expect(handlers[handler]).toHaveBeenCalled();
  });

  test("a failed load says so and starts no set, since the sets shown may be out of date", async () => {
    const handlers = renderSets(true, "Failed to fetch");

    expect(screen.getByText(/Couldn’t load the sets: Failed to fetch/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next set" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(handlers.onReload).toHaveBeenCalled();
  });

  test("a player sees the sets but cannot open, record, or delete them", () => {
    renderSets(false);

    expect(screen.queryByRole("button", { name: "Open set 1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Next set|Start set 1/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete set 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stats and highlights" })).toBeEnabled();
  });
});
