import { fireEvent, render, screen, within } from "@testing-library/react";
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
  const onFinish = vi.fn<(finished: boolean) => Promise<boolean>>(async () => true);
  const onFocus = vi.fn<(focus: boolean) => void>();

  render(
    <TooltipProvider>
      <Tracker
        initial={initial}
        names={{ us: "Eagles", them: "Riverside" }}
        onFocus={onFocus}
        onChange={onChange}
        onNextSet={() => {}}
        onFinish={onFinish}
        header={<h1>Set 1</h1>}
      />
    </TooltipProvider>
  );

  return { onChange, onFinish, onFocus, last: () => onChange.mock.calls.at(-1)?.[0] };
}

const section = (name: string) => within(screen.getByRole("region", { name }));
const detailed = (): AppData => ({
  ...emptyData(["Mira", "Suki"]),
  meta: { ...emptyData().meta, detailed: true },
});

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
    expect(screen.getByRole("region", { name: "Recorded stats" })).toHaveTextContent("Mira Serve Ace z1");
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

  test("the players' Change button opens the list, where a player is added and dragged to a new number key", async () => {
    const { last } = renderTracker();

    await userEvent.click(section("Player").getByRole("button", { name: "Change" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Player name" }), "Ana, Bo{Enter}");
    expect(last()?.players).toEqual(["Mira", "Suki", "Ana", "Bo"]);

    const row = (name: string) => within(screen.getByRole("dialog")).getByText(name).closest("li")!;

    fireEvent.dragStart(row("Bo"), { dataTransfer: {} });
    fireEvent.dragOver(row("Mira"));
    fireEvent.drop(row("Mira"));
    expect(last()?.players).toEqual(["Bo", "Mira", "Suki", "Ana"]);

    await userEvent.click(screen.getByRole("button", { name: "Move Bo down" }));
    expect(last()?.players).toEqual(["Mira", "Bo", "Suki", "Ana"]);
  });

  test("a freeball is a kind of attack, and its zone is on the opponent's court", async () => {
    const { last } = renderTracker();

    await userEvent.keyboard("1a");
    expect(section("Kind").getAllByRole("button")).toHaveLength(2);

    await userEvent.click(section("Kind").getByRole("button", { name: "Freeball" }));
    await userEvent.click(section("Result").getByRole("button", { name: /Dig 2-3/ }));
    expect(screen.getByRole("region", { name: "Zone" })).toHaveTextContent("Their court, seen from ours");
    expect(section("Zone").getByRole("button", { name: /N\/A/ })).toBeInTheDocument();

    await userEvent.keyboard("5");

    expect(last()?.events).toEqual([expect.objectContaining({ stat: "freeball", result: "dig23", zone: "5" })]);
    expect(last()?.events[0]).not.toHaveProperty("type");
    expect(screen.getByRole("region", { name: "Recorded stats" })).toHaveTextContent("Mira Attack, freeball Dig 2-3");
  });

  test.each([
    { keys: "1t22", touch: { stat: "attack", type: "tip", result: "dig01", zone: "2" } },
    { keys: "1a1", touch: { stat: "attack", type: "hit", result: "kill" } },
    { keys: "1dc25", touch: { stat: "defense", type: "block_cover", result: "dig23", zone: "5" } },
  ])("with detailed stats, $keys records $touch.stat as a $touch.type", async ({ keys, touch }) => {
    const { last } = renderTracker(detailed());

    await userEvent.keyboard(keys);
    if (!touch.zone) await userEvent.keyboard("4");

    expect(last()?.events).toEqual([expect.objectContaining(touch)]);
  });

  test("turning on detailed stats mid-entry changes what the entry offers and what the keys record", async () => {
    const { last } = renderTracker();

    await userEvent.keyboard("1a");
    await userEvent.click(screen.getByRole("button", { name: "Set actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Turn on detailed stats" }));
    expect(section("Result").getByRole("button", { name: /Dig 0-1/ })).toBeInTheDocument();

    await userEvent.keyboard("t24");
    expect(last()?.events).toEqual([expect.objectContaining({ stat: "attack", type: "tip", result: "dig01" })]);

    await userEvent.click(screen.getByRole("button", { name: "Set actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Turn off detailed stats" }));
    expect(JSON.parse(JSON.stringify(last()?.meta))).not.toHaveProperty("detailed");
  });

  test("a recorded stat's time is nudged, or set to the video's, while editing it", async () => {
    const { last } = renderTracker({
      ...emptyData(["Mira"]),
      events: [{ kind: "touch", id: 1, timestamp: 10, player: "Mira", stat: "serve", result: "ace", zone: "1" }],
    });

    await userEvent.click(screen.getByRole("button", { name: "Edit set" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.click(screen.getByRole("button", { name: "+0.5s" }));
    await userEvent.click(screen.getByRole("button", { name: "+0.5s" }));
    await userEvent.click(screen.getByRole("button", { name: "−0.5s" }));
    await userEvent.click(screen.getByRole("button", { name: /Save/ }));
    expect(last()?.events[0]).toMatchObject({ timestamp: 10.5, result: "ace" });

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.click(screen.getByRole("button", { name: "Set to video time" }));
    await userEvent.click(screen.getByRole("button", { name: /Save/ }));
    expect(last()?.events[0]).toMatchObject({ timestamp: 0 });
  });

  test("a set with stats opens locked: nothing changes it until Edit set, and Done locks it again", async () => {
    const set: AppData = {
      ...emptyData(["Mira"]),
      events: [{ kind: "touch", id: 1, timestamp: 10, player: "Mira", stat: "serve", result: "ace", zone: "1" }],
    };
    const { last, onFinish } = renderTracker(set);

    await userEvent.keyboard("1s11+");
    await userEvent.click(section("Player").getByRole("button", { name: /Mira/ }));
    expect(last()?.events).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /New stat/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Result" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Stat entry" })).toHaveTextContent(
      "Locked, so nothing changes it by accident."
    );
    for (const name of ["Edit", "Delete", "Change", "Undo"])
      expect(screen.getByRole("button", { name })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Edit set" }));
    expect(onFinish).toHaveBeenLastCalledWith(false);
    await userEvent.keyboard("+");
    expect(last()?.events).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onFinish).toHaveBeenLastCalledWith(true);
    expect(await screen.findByRole("button", { name: "Edit set" })).toBeInTheDocument();
  });

  test("as panes, X and its button move the entry beside the video or under it, and the choice is remembered", async () => {
    localStorage.setItem(
      "volleyvector:tracker:layout",
      JSON.stringify({ arrangement: "beside", beside: { columns: 1 } })
    );
    render(
      <TooltipProvider>
        <Tracker
          initial={emptyData(["Mira"])}
          names={{ us: "Eagles", them: "Riverside" }}
          panes
          onChange={() => {}}
          onNextSet={() => {}}
          onFinish={async () => true}
          header={<h1>Set 1</h1>}
        />
      </TooltipProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "Put the entry under the video" }));
    expect(JSON.parse(localStorage.getItem("volleyvector:tracker:layout") ?? "{}")).toMatchObject({
      arrangement: "below",
    });

    await userEvent.keyboard("x");
    expect(screen.getByRole("button", { name: "Put the entry under the video" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Stat entry" })).toBeInTheDocument();
    localStorage.clear();
  });

  test("focus mode is switched by its button and by V, on a locked set too", async () => {
    const { onFocus } = renderTracker({
      ...emptyData(["Mira"]),
      events: [{ kind: "point", id: 1, timestamp: 1, winner: "us" }],
    });

    await userEvent.click(screen.getByRole("button", { name: "Focus mode" }));
    await userEvent.keyboard("v");
    expect(onFocus.mock.calls).toEqual([[true], [true]]);
  });
});
