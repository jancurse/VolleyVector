import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { emptyData } from "../../../src/stats/store";
import { Tracker } from "../../../src/stats/tracker/Tracker";
import type { AppData } from "../../../src/stats/types";
import { TooltipProvider } from "../../../src/ui/Tooltip";

vi.mock("../../../src/supabase/client", async () => {
  const mod = await import("../../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

function renderTracker(initial: AppData = emptyData(["Mira", "Suki"])) {
  const onChange = vi.fn<(data: AppData) => void>();

  render(
    <TooltipProvider>
      <Tracker
        initial={initial}
        names={{ us: "Eagles", them: "Riverside" }}
        finished={false}
        onChange={onChange}
        onNextSet={() => {}}
        onFinish={() => {}}
        header={<h1>Set 1</h1>}
      />
    </TooltipProvider>
  );

  return { onChange, last: () => onChange.mock.calls.at(-1)?.[0] };
}

const scoreboard = () => screen.getByRole("region", { name: "Scoreboard" });

describe("Tracker", () => {
  test("records a stat by keyboard: player, skill, result, then zone", async () => {
    const { last } = renderTracker();

    await userEvent.keyboard("1s1");
    expect(screen.getByRole("region", { name: "Zone" })).toBeInTheDocument();

    await userEvent.keyboard("1");

    expect(last()?.events).toEqual([
      expect.objectContaining({ kind: "touch", player: "Mira", stat: "serve", result: "ace", zone: "1" }),
    ]);
    expect(screen.getByRole("region", { name: "Recorded stats" })).toHaveTextContent("Mira serve Ace z1");
    expect(scoreboard()).toHaveTextContent("Eagles1");
  });

  test.each([
    { key: "+", side: "Eagles" },
    { key: "-", side: "Riverside" },
  ])("a manual point ($key) scores for $side, and undo takes it back", async ({ key }) => {
    const { last } = renderTracker();

    await userEvent.keyboard(key);
    expect(last()?.events).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: /Undo/ }));
    expect(last()?.events).toHaveLength(0);
  });

  test("clicking through the entry records the same stat as the keys", async () => {
    const { last } = renderTracker();

    await userEvent.click(screen.getByRole("button", { name: /New stat/ }));
    await userEvent.click(within(screen.getByRole("region", { name: "Player" })).getByRole("button", { name: /Suki/ }));
    await userEvent.click(
      within(screen.getByRole("region", { name: "Skill" })).getByRole("button", { name: /Attack/ })
    );
    await userEvent.click(within(screen.getByRole("region", { name: "Result" })).getByRole("button", { name: /Kill/ }));
    await userEvent.click(within(screen.getByRole("region", { name: "Zone" })).getByRole("button", { name: /Z5/ }));

    expect(last()?.events).toEqual([
      expect.objectContaining({ player: "Suki", stat: "attack", result: "kill", zone: "5" }),
    ]);
  });

  test("players added in the panel get the next number key", async () => {
    const { last } = renderTracker();

    await userEvent.click(screen.getByRole("button", { name: "Players" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Player name" }), "Ana, Bo{Enter}");

    expect(last()?.players).toEqual(["Mira", "Suki", "Ana", "Bo"]);
  });
});
