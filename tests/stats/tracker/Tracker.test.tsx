import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { POINT_REASONS } from "../../../src/stats/codes";
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
/** Load a video file, so the video has a time of its own that the arrow keys move. */
const loadVideo = async () => {
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = () => "blob:video";
      static revokeObjectURL = () => {};
    }
  );
  await userEvent.upload(
    screen.getByLabelText("Load local video"),
    new File(["video"], "set.mp4", { type: "video/mp4" })
  );
};

describe("Tracker", () => {
  afterEach(() => vi.unstubAllGlobals());

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
  ])(
    "with detailed stats, $keys records $touch.stat as a $touch.type, and nothing of theirs",
    async ({ keys, touch }) => {
      const { last } = renderTracker(detailed());

      await userEvent.keyboard(keys);
      if (!touch.zone) await userEvent.keyboard("4");

      expect(last()?.events).toEqual([expect.objectContaining(touch)]);
    }
  );

  test("turning on detailed stats mid-entry changes what the entry offers and what the keys record", async () => {
    const { last } = renderTracker();

    await userEvent.keyboard("1a");
    await userEvent.click(screen.getByRole("button", { name: "Set actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Turn on detailed stats" }));
    expect(section("Result").getByRole("button", { name: /Dig 0-1/ })).toBeInTheDocument();

    await userEvent.keyboard("t24");
    expect(last()?.events[0]).toEqual(expect.objectContaining({ stat: "attack", type: "tip", result: "dig01" }));

    await userEvent.click(screen.getByRole("button", { name: "Set actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Turn off detailed stats" }));
    expect(JSON.parse(JSON.stringify(last()?.meta))).not.toHaveProperty("detailed");
  });

  test("an open row is moved in time by a tenth of a second, or by half a second with Alt, and saved at once", async () => {
    const { last } = renderTracker({
      ...emptyData(["Mira"]),
      events: [{ kind: "touch", id: 1, timestamp: 10, player: "Mira", stat: "serve", result: "ace", zone: "1" }],
    });

    await loadVideo();
    await userEvent.click(screen.getByRole("button", { name: "Edit set" }));
    // A click only jumps to the row. The pencil opens it.
    await userEvent.click(section("Recorded stats").getByRole("button", { name: /Mira Serve/ }));
    expect(screen.queryByRole("button", { name: "Later" })).not.toBeInTheDocument();
    await userEvent.click(section("Recorded stats").getByRole("button", { name: "Edit" }));
    await userEvent.click(screen.getByRole("button", { name: "Later" }));
    await userEvent.click(screen.getByRole("button", { name: "Later" }));
    await userEvent.click(screen.getByRole("button", { name: "Earlier" }));
    expect(last()?.events[0]?.timestamp).toBeCloseTo(10.1);

    await userEvent.keyboard("{Alt>}>{/Alt}<");
    expect(last()?.events[0]).toMatchObject({ result: "ace" });
    expect(last()?.events[0]?.timestamp).toBeCloseTo(10.5);

    // The video is moved on its own, and the row is then put where the video is.
    await userEvent.keyboard("{ArrowRight}");
    expect(last()?.events[0]?.timestamp).toBeCloseTo(10.5);
    await userEvent.click(screen.getByRole("button", { name: /Set to video time/ }));
    expect(last()?.events[0]?.timestamp).toBeCloseTo(12.5);
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}/");
    expect(last()?.events[0]?.timestamp).toBeCloseTo(17.5);
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
    for (const name of ["Delete", "Change", "Undo"]) expect(screen.getByRole("button", { name })).toBeDisabled();

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

  test("marks are saved with the set, so a reload keeps them", async () => {
    const { last } = renderTracker();

    await userEvent.keyboard("{Tab}{Tab}");
    expect(last()?.draft?.contacts).toHaveLength(2);
    expect(last()?.events).toHaveLength(0);

    cleanup();
    renderTracker(last());
    expect(screen.getByRole("button", { name: /Next contact/ })).toBeInTheDocument();
    expect(section("Recorded stats").getAllByText("2 to describe")).not.toHaveLength(0);
  });

  test("marked contacts sit in the list and are described in any order: ↓ moves on, Delete drops one, saving opens the next", async () => {
    const { last } = renderTracker();
    const rows = () => section("Recorded stats").queryAllByRole("button", { name: /(Contact|Serve)\?/ });

    await userEvent.keyboard("{Tab}{Tab}{Tab}");
    expect(rows()).toHaveLength(3);
    expect(section("Recorded stats").getAllByText("3 to describe")).not.toHaveLength(0);

    await userEvent.keyboard("{Enter}");
    expect(await section("Stat entry").findByText("Marked contact · 3 left")).toBeInTheDocument();
    expect(rows()[0]).toHaveAttribute("aria-current", "true");

    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => expect(rows()[1]).toHaveAttribute("aria-current", "true"));
    await userEvent.keyboard("{Delete}");
    await section("Stat entry").findByText("Marked contact · 2 left");
    await userEvent.keyboard("1s11");

    expect(last()?.events).toHaveLength(1);
    expect(await screen.findByRole("button", { name: /Next contact/ })).toBeInTheDocument();
    expect(rows()).toHaveLength(1);

    await userEvent.click(rows()[0]!);
    expect(rows()[0]).toHaveAttribute("aria-current", "true");
    expect(section("Stat entry").queryByText("Marked contact · 1 left")).not.toBeInTheDocument();
    await userEvent.dblClick(rows()[0]!);
    await section("Stat entry").findByText("Marked contact · 1 left");
    await userEvent.keyboard("2r11");

    expect(last()?.events).toHaveLength(2);
    expect(last()).not.toHaveProperty("draft");
  });

  test("a stat started with the video on a marked contact describes that contact, and leaves no twin beside it", async () => {
    const { last } = renderTracker();

    await userEvent.keyboard("{Tab}1s11");

    expect(last()?.events).toHaveLength(1);
    expect(last()).not.toHaveProperty("draft");
  });

  test("with a contact open, Tab adds one at the video's time and opens it, and Esc leaves both to describe", async () => {
    const { last } = renderTracker();

    await userEvent.keyboard("{Tab}{Enter}");
    await section("Stat entry").findByText("Marked contact · 1 left");
    await userEvent.keyboard("{Tab}");
    await section("Stat entry").findByText("Marked contact · 2 left");

    await userEvent.keyboard("{Escape}");
    expect(await screen.findByRole("button", { name: /Next contact/ })).toBeInTheDocument();
    expect(last()?.draft?.contacts).toHaveLength(2);
    expect(last()?.events).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "New stat" }));
    expect(await section("Stat entry").findByText(/New stat/)).toBeInTheDocument();
  });

  test("↓ and ↑ go through every row, and a recorded one opens to be changed", async () => {
    const { last } = renderTracker();

    await userEvent.keyboard("1s11{Tab}{Enter}");
    await section("Stat entry").findByText("Marked contact · 1 left");

    await userEvent.keyboard("{ArrowUp}");
    expect(await section("Stat entry").findByText("Editing")).toBeInTheDocument();
    await userEvent.click(section("Result").getByRole("button", { name: /Out/ }));
    await userEvent.keyboard("{ArrowDown}");

    await section("Stat entry").findByText("Marked contact · 1 left");
    expect(last()?.events).toEqual([expect.objectContaining({ stat: "serve", result: "out" })]);
  });

  test("a model's contact opens with its skill suggested, the opponent's as their touch, and its time can be moved", async () => {
    const { last } = renderTracker({
      ...detailed(),
      draft: {
        rallies: [{ start: 30, end: 40, serving: "them" }],
        contacts: [
          { id: 1, time: 1, side: "them", skill: "serve", model: true },
          { id: 2, time: 2, side: "us", skill: "receive", model: true },
        ],
      },
    });

    await userEvent.keyboard("{Enter}");
    await userEvent.click(section("Opponent’s touch").getByRole("button", { name: "Later" }));
    await userEvent.click(section("Opponent’s touch").getByRole("button", { name: /Save their serve/ }));
    expect(await section("Skill").findByRole("button", { name: /Receive/, pressed: true })).toBeInTheDocument();

    await userEvent.click(section("Stat entry").getByRole("button", { name: "Later" }));
    await userEvent.keyboard("111");
    expect(last()?.events).toEqual([
      expect.objectContaining({ kind: "opponent", stat: "serve" }),
      expect.objectContaining({ kind: "touch", stat: "receive" }),
    ]);
    expect(last()?.events.map((e) => e.timestamp)).toEqual([expect.closeTo(1.1), expect.closeTo(2.1)]);
    expect(last()?.draft?.contacts).toEqual([]);
  });

  test("with detailed stats, two of their serves are an ace", async () => {
    renderTracker(detailed());

    await userEvent.keyboard("oso{Enter}");
    expect(scoreboard()).toHaveTextContent("Riverside1");
    expect(section("Recorded stats").getAllByLabelText("Their serve")).toHaveLength(2);
  });

  test("a set without detailed stats records none of the opponent's touches", async () => {
    const { last } = renderTracker();

    await userEvent.keyboard("o");
    expect(screen.queryByRole("region", { name: "Opponent’s touch" })).not.toBeInTheDocument();
    expect(last()?.events).toHaveLength(0);
  });

  test("a point entered by hand is its rally's End row, which shows its reason and deletes it", async () => {
    const { last } = renderTracker();

    await userEvent.keyboard("+1");

    const log = section("Recorded stats");

    expect(log.getByRole("button", { name: /End Won · 1–0/ })).toHaveTextContent(POINT_REASONS.us[0]!.label);
    expect(log.queryByText(/Point us/)).not.toBeInTheDocument();

    await userEvent.click(log.getByRole("button", { name: "Delete" }));
    expect(last()?.events).toEqual([]);
  });

  test("a rally decided by who served next asks why on its End row, and the answer records the point", async () => {
    const { last } = renderTracker({
      ...emptyData(["Mira"]),
      events: [
        { kind: "touch", id: 1, timestamp: 1, player: "Mira", stat: "receive", result: "dig23", zone: "1" },
        { kind: "touch", id: 2, timestamp: 20, player: "Mira", stat: "serve", result: "dig23", zone: "1" },
      ],
    });

    expect(screen.queryByRole("combobox", { name: "Why the rally ended" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit set" }));
    expect(section("Recorded stats").getByText("from who served next")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("combobox", { name: "Why the rally ended" }));
    await userEvent.click(await screen.findByRole("option", { name: POINT_REASONS.us[0]!.label }));

    expect(last()?.events).toContainEqual(
      expect.objectContaining({ kind: "point", winner: "us", reason: POINT_REASONS.us[0]!.id })
    );
    expect(screen.queryByRole("combobox", { name: "Why the rally ended" })).not.toBeInTheDocument();
  });

  test("a picked row is opened by Enter and removed by Delete, and ↓ picks the next without opening it", async () => {
    const { last } = renderTracker();
    const rows = () => section("Recorded stats").getAllByRole("button", { name: /Mira Serve/ });

    await userEvent.keyboard("1s111s11");
    await userEvent.click(rows()[0]!);
    await userEvent.keyboard("{ArrowDown}");
    expect(rows()[1]).toHaveAttribute("aria-current", "true");
    expect(section("Stat entry").queryByText("Editing")).not.toBeInTheDocument();

    await userEvent.keyboard("{Enter}");
    expect(await section("Stat entry").findByText("Editing")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await userEvent.click(rows()[0]!);
    await userEvent.keyboard("{Delete}");
    expect(last()?.events).toHaveLength(1);

    await userEvent.keyboard("{Tab}");
    await userEvent.click(section("Recorded stats").getByRole("button", { name: /Serve\?/ }));
    await userEvent.keyboard("{Delete}");
    expect(last()).not.toHaveProperty("draft");
  });

  test("a new entry leaves a picked row alone: moving its time and Delete do not touch that row", async () => {
    const { last } = renderTracker(detailed());

    await userEvent.keyboard("1s11");
    await userEvent.click(section("Recorded stats").getByRole("button", { name: /Mira Serve/ }));
    await userEvent.keyboard("o>{Delete}");

    expect(last()?.events).toEqual([expect.objectContaining({ stat: "serve", timestamp: 0 })]);
    expect(screen.getByRole("region", { name: "Opponent’s touch" })).toBeInTheDocument();
  });

  test("with detailed stats, the first mark of a rally they serve opens as their serve, and O switches sides", async () => {
    const data = detailed();
    const { last } = renderTracker({ ...data, meta: { ...data.meta, firstServe: "them" } });

    await userEvent.keyboard("{Tab}{Enter}");
    expect(await screen.findByRole("region", { name: "Opponent’s touch" })).toBeInTheDocument();

    await userEvent.keyboard("o");
    expect(screen.queryByRole("region", { name: "Opponent’s touch" })).not.toBeInTheDocument();
    await userEvent.keyboard("o{Enter}");

    expect(last()?.events).toEqual([expect.objectContaining({ kind: "opponent", stat: "serve" })]);
    expect(last()).not.toHaveProperty("draft");
  });

  test("the first mark of a rally we serve opens as a serve by the player in position 1 of that rally", async () => {
    const lineup = ["Ada", "Bea", "Cy", "Dot", "Eve", "Flo"];
    const data = emptyData(lineup);

    renderTracker({
      ...data,
      meta: { ...data.meta, firstServe: "them", lineup },
      // We win the rally they served, so we rotate and the next player serves.
      events: [
        { kind: "touch", id: 1, timestamp: 0, player: "Ada", stat: "receive", result: "dig23", zone: "1" },
        { kind: "touch", id: 2, timestamp: 0, player: "Bea", stat: "attack", result: "kill", zone: "1" },
      ],
    });

    await userEvent.click(screen.getByRole("button", { name: "Edit set" }));
    await userEvent.keyboard("{Tab}{Enter}");

    expect(await section("Skill").findByRole("button", { name: /Serve/, pressed: true })).toBeInTheDocument();
    expect(section("Player").getByRole("button", { name: /Bea/, pressed: true })).toBeInTheDocument();
  });

  test("a stat, a mark and their serve take the video's exact time", async () => {
    const { last } = renderTracker(detailed());

    await loadVideo();
    // Two seconds into the video.
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("1s11{Tab}o{Enter}");

    expect(last()?.events.map((e) => e.timestamp)).toEqual([2, 2]);
    expect(last()?.draft?.contacts.map((c) => c.time)).toEqual([2]);
  });

  test("a key pressed during play starts a stat of its own beside a mark, and paused on the mark describes it", async () => {
    const { last } = renderTracker();

    await loadVideo();
    await userEvent.keyboard("{Tab}");
    fireEvent.play(screen.getByRole("region", { name: "Video" }).querySelector("video")!);
    await userEvent.keyboard("1s11");
    expect(last()?.events).toHaveLength(1);
    expect(last()?.draft?.contacts).toHaveLength(1);

    fireEvent.pause(screen.getByRole("region", { name: "Video" }).querySelector("video")!);
    await userEvent.keyboard("2s11");
    expect(last()?.events).toHaveLength(2);
    expect(last()).not.toHaveProperty("draft");
  });

  test("moving on from a new stat left half entered keeps it as a contact to describe", async () => {
    const { last } = renderTracker();

    await loadVideo();
    await userEvent.keyboard("1s11{ArrowRight}2{ArrowUp}");

    expect(await section("Stat entry").findByText("Editing")).toBeInTheDocument();
    expect(last()?.draft?.contacts).toEqual([{ id: 1, time: 2 }]);
  });

  test("a serve row names who serves, and the rally's header names them only while no serve is recorded", () => {
    const data = detailed();

    renderTracker({
      ...data,
      events: [{ kind: "opponent", id: 1, timestamp: 1, stat: "serve" }],
      draft: { rallies: [{ start: 30, end: 35, serving: "us" }], contacts: [] },
    });

    const log = section("Recorded stats");

    expect(log.getByLabelText("Their serve").parentElement).toHaveTextContent("Riverside");
    expect(log.getAllByLabelText("Serves")).toHaveLength(1);
    expect(log.getByLabelText("Serves").parentElement).toHaveTextContent("Eagles");
  });

  describe("Draft with AI", () => {
    const answer = (text: string) =>
      Response.json({
        status: "completed",
        steps: [{ type: "model_output", content: [{ text }] }],
        usage: { total_input_tokens: 100_000, total_output_tokens: 1000 },
      });
    const rallies = '{"rallies": [{"serve": "00:10", "end": "00:14"}]}';
    const withLink = (youtubeUrl = "https://youtu.be/abcdefghijk"): AppData => {
      const data = emptyData(["Mira", "Suki"]);

      return { ...data, meta: { ...data.meta, youtubeUrl } };
    };
    /** Open the dialog and fill it in, leaving out what `skip` names. */
    const fill = async (skip: "key" | "half" | null = null, from = "01:00", to = "") => {
      await userEvent.click(screen.getByRole("button", { name: "Draft with AI" }));
      await screen.findByRole("dialog");
      if (skip !== "key") await userEvent.type(screen.getByLabelText("Gemini API key"), "my-key");
      if (skip !== "half") {
        await userEvent.click(screen.getByRole("combobox", { name: "Our half of the court" }));
        await userEvent.click(await screen.findByRole("option", { name: "Near the camera" }));
      }
      if (from) await userEvent.type(screen.getByLabelText("Set starts at"), from);
      if (to) await userEvent.type(screen.getByLabelText("Set ends at"), to);
    };

    test("runs the model on the set's YouTube link and loads each rally as it comes back", async () => {
      const answers = [rallies, '{"serving": "us", "serve": 3.2}'];
      const fetchMock = vi.fn<typeof fetch>(async () => answer(answers.shift()!));

      vi.stubGlobal("fetch", fetchMock);

      const { last } = renderTracker(withLink());

      await fill();
      // A text field drawn as dots, so the browser offers no password to save.
      expect(screen.getByLabelText("Gemini API key")).not.toHaveAttribute("type", "password");
      await userEvent.click(screen.getByRole("button", { name: "Start" }));

      expect(await screen.findByText(/AI draft ready: 1 rally, for about \$0\.32/)).toBeInTheDocument();
      expect(last()?.meta).not.toHaveProperty("detailed");
      // The rally's call places the serve more exactly than the first pass, and puts no contact in the list.
      expect(last()?.draft).toEqual({ rallies: [{ start: 70.2, end: 74, serving: "us" }], contacts: [] });
      expect(screen.queryByRole("button", { name: "Draft with AI" })).not.toBeInTheDocument();
      expect(scoreboard()).toHaveTextContent("with 1 rally not recorded yet");

      const sent = fetchMock.mock.calls.map(([, init]) => ({
        key: new Headers(init?.headers).get("x-goog-api-key"),
        video: JSON.parse(String(init?.body)).input[0],
      }));

      expect(sent.map((c) => c.key)).toEqual(["my-key", "my-key"]);
      expect(sent.map((c) => c.video.processing)).toEqual([
        { type: "static", fps: 1, start_offset: "60s" },
        { type: "static", fps: 2, start_offset: "67s", end_offset: "76s" },
      ]);
      expect(sent[0]?.video.uri).toBe("https://www.youtube.com/watch?v=abcdefghijk");

      expect(screen.queryByLabelText("Gemini API key")).not.toBeInTheDocument();
      expect(JSON.stringify({ ...localStorage, ...sessionStorage, data: last() })).not.toContain("my-key");

      // A rally the model found that is none is removed from its header.
      await userEvent.click(section("Recorded stats").getByRole("button", { name: "Remove rally 1" }));
      expect(last()).not.toHaveProperty("draft");
    });

    test.each<[string, () => Response, unknown, RegExp]>([
      [
        "a rally whose call fails keeps its place, with no guess at who serves",
        () => Response.json({ error: { message: "bad request" } }, { status: 400 }),
        { rallies: [{ start: 70, end: 74, serving: null }], contacts: [] },
        /AI draft ready: 1 rally.*Rallies without a guess at who serves: 1/,
      ],
      [
        "so does one the model names no server for",
        () => answer('{"serving": null}'),
        { rallies: [{ start: 70, end: 74, serving: null }], contacts: [] },
        /Rallies without a guess at who serves: 1/,
      ],
    ])("%s", async (_name, second, draft, notice) => {
      const calls = [() => answer(rallies), second];

      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>(async () => calls.shift()!())
      );

      const { last } = renderTracker(withLink());

      await fill();
      await userEvent.click(screen.getByRole("button", { name: "Start" }));

      expect(await screen.findByText(notice)).toBeInTheDocument();
      expect(last()?.draft).toEqual(draft);
    });

    test.each<[string, () => Response, RegExp]>([
      ["no rally found says so", () => answer('{"rallies": []}'), /The AI found no rally in that part of the video/],
      [
        "a refused first call shows Google's message in the dialog",
        () => Response.json({ error: { message: "API key not valid" } }, { status: 400 }),
        /API key not valid/,
      ],
      [
        "more rallies than a set holds stops before a call for each",
        () =>
          answer(
            '{"rallies": [{"serve": "00:00", "end": "00:20"}, {"serve": "01:00", "end": "01:20"}, {"serve": "02:00", "end": "02:20"}, {"serve": "03:00", "end": "03:20"}, {"serve": "04:00", "end": "04:20"}, {"serve": "05:00", "end": "05:20"}, {"serve": "06:00", "end": "06:20"}, {"serve": "07:00", "end": "07:20"}, {"serve": "08:00", "end": "08:20"}, {"serve": "09:00", "end": "09:20"}, {"serve": "10:00", "end": "10:20"}, {"serve": "11:00", "end": "11:20"}, {"serve": "12:00", "end": "12:20"}, {"serve": "13:00", "end": "13:20"}, {"serve": "14:00", "end": "14:20"}, {"serve": "15:00", "end": "15:20"}, {"serve": "16:00", "end": "16:20"}, {"serve": "17:00", "end": "17:20"}, {"serve": "18:00", "end": "18:20"}, {"serve": "19:00", "end": "19:20"}, {"serve": "20:00", "end": "20:20"}, {"serve": "21:00", "end": "21:20"}, {"serve": "22:00", "end": "22:20"}, {"serve": "23:00", "end": "23:20"}, {"serve": "24:00", "end": "24:20"}, {"serve": "25:00", "end": "25:20"}, {"serve": "26:00", "end": "26:20"}, {"serve": "27:00", "end": "27:20"}, {"serve": "28:00", "end": "28:20"}, {"serve": "29:00", "end": "29:20"}, {"serve": "30:00", "end": "30:20"}, {"serve": "31:00", "end": "31:20"}, {"serve": "32:00", "end": "32:20"}, {"serve": "33:00", "end": "33:20"}, {"serve": "34:00", "end": "34:20"}, {"serve": "35:00", "end": "35:20"}, {"serve": "36:00", "end": "36:20"}, {"serve": "37:00", "end": "37:20"}, {"serve": "38:00", "end": "38:20"}, {"serve": "39:00", "end": "39:20"}, {"serve": "40:00", "end": "40:20"}, {"serve": "41:00", "end": "41:20"}, {"serve": "42:00", "end": "42:20"}, {"serve": "43:00", "end": "43:20"}, {"serve": "44:00", "end": "44:20"}, {"serve": "45:00", "end": "45:20"}, {"serve": "46:00", "end": "46:20"}, {"serve": "47:00", "end": "47:20"}, {"serve": "48:00", "end": "48:20"}, {"serve": "49:00", "end": "49:20"}, {"serve": "50:00", "end": "50:20"}, {"serve": "51:00", "end": "51:20"}, {"serve": "52:00", "end": "52:20"}, {"serve": "53:00", "end": "53:20"}, {"serve": "54:00", "end": "54:20"}, {"serve": "55:00", "end": "55:20"}, {"serve": "56:00", "end": "56:20"}, {"serve": "57:00", "end": "57:20"}, {"serve": "58:00", "end": "58:20"}, {"serve": "59:00", "end": "59:20"}, {"serve": "60:00", "end": "60:20"}, {"serve": "61:00", "end": "61:20"}, {"serve": "62:00", "end": "62:20"}, {"serve": "63:00", "end": "63:20"}, {"serve": "64:00", "end": "64:20"}, {"serve": "65:00", "end": "65:20"}, {"serve": "66:00", "end": "66:20"}, {"serve": "67:00", "end": "67:20"}, {"serve": "68:00", "end": "68:20"}, {"serve": "69:00", "end": "69:20"}, {"serve": "70:00", "end": "70:20"}]}'
          ),
        /The AI found 71 rallies, more than one set holds/,
      ],
    ])("%s, and nothing is loaded", async (_name, first, message) => {
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>(async () => first())
      );

      const { last } = renderTracker(withLink());

      await fill();
      await userEvent.click(screen.getByRole("button", { name: "Start" }));

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(last()?.draft).toBeUndefined();
    });

    test("Stop ends a run without an error", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>(
          (_url, init) =>
            new Promise((_resolve, reject) =>
              init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))
            )
        )
      );
      renderTracker(withLink());

      await fill();
      await userEvent.click(screen.getByRole("button", { name: "Start" }));
      await userEvent.click(await screen.findByRole("button", { name: "Stop" }));

      await waitFor(() => expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument());
      expect(screen.queryByText("aborted")).not.toBeInTheDocument();
    });

    test.each<[string, "key" | "half" | null, string, string, string | undefined, boolean]>([
      ["everything given", null, "01:00", "02:00", undefined, true],
      ["no key", "key", "01:00", "", undefined, false],
      ["no half chosen", "half", "01:00", "", undefined, false],
      ["a start that is no time", null, "abc", "", undefined, false],
      ["an end before the start", null, "02:00", "01:00", undefined, false],
      ["no YouTube link on the set", null, "01:00", "", "", false],
    ])(
      "Start is offered only with a key, our half, readable times and a link: %s",
      async (_name, skip, from, to, url, ok) => {
        renderTracker(withLink(url));
        await fill(skip, from, to);

        if (ok) expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
        else expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
      }
    );
  });
});
