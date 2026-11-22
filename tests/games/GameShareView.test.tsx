import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AuthProvider } from "../../src/auth/useAuth";
import { GameShareView } from "../../src/games/GameShareView";
import { recordedRpcs, recordedWrites, resetRecorded } from "../helpers/supabaseFake";

vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

beforeEach(resetRecorded);

const open = (token: string) =>
  render(
    <AuthProvider>
      <GameShareView token={token} />
    </AuthProvider>
  );

describe("GameShareView", () => {
  test("a share link opens the game page read-only, from the one public function", async () => {
    open("game-token");

    expect(await screen.findByRole("heading", { name: "Cup final" })).toBeInTheDocument();
    expect(screen.getByText("25–20")).toBeInTheDocument();
    expect(screen.getByText("Lena Vogt")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Game actions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pick squad" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Guide/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Rotations" }));

    const rotation = screen.getByRole("region", { name: "Set 1" });

    expect(within(rotation).getByText(/Lena Vogt/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Print slips" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add rotation" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Stats" }));

    expect(await screen.findByText("No stats saved yet.")).toBeInTheDocument();
    expect(recordedRpcs.map((r) => r.fn)).toEqual(["game_by_token"]);
    expect(recordedWrites).toEqual([]);
  });

  test("a link that is not shared says so", async () => {
    open("stopped");

    expect(await screen.findByText(/This link doesn’t open a game/)).toBeInTheDocument();
  });
});
