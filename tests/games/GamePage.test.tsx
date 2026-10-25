import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { GamePage } from "../../src/games/GamePage";
import type { Game } from "../../src/games/types";
import { GAME, ROSTER } from "../helpers/gameData";

function renderPage(canEdit: boolean, game: Game = GAME) {
  const onSave = vi.fn((_: Game) => Promise.resolve({ error: null }));

  render(
    <GamePage
      game={game}
      teamName="Eagles"
      roster={ROSTER}
      canEdit={canEdit}
      onSave={onSave}
      onDelete={() => {}}
      onPrint={() => {}}
    />
  );

  return onSave;
}

const lastSaved = (onSave: ReturnType<typeof renderPage>): Game => onSave.mock.calls.at(-1)![0];
const lineup = () => screen.getByRole("region", { name: "Set 1" });

describe("GamePage as a coach", () => {
  test("a new lineup starts as a 5-1 with the setter in I and saves itself", async () => {
    const onSave = renderPage(true, { ...GAME, lineups: [] });

    await userEvent.click(screen.getByRole("button", { name: "Add lineup" }));

    const region = screen.getByRole("region", { name: "Lineup 1" });

    expect(within(region).getByRole("button", { name: "Position I: #1 Lena Vogt" })).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Libero: #2 Tess Moor" })).toBeInTheDocument();
    await waitFor(() => expect(lastSaved(onSave).lineups[0].positions[0]).toBe("p-s"));
  });

  test.each([
    ["Rotate forward (II → I)", "#4 Mia Kraus", "Setter in VI"],
    ["Rotate back (I → II)", "#15 Ida Berg", "Setter in II"],
  ])("%s on the slip moves everyone one position", async (button, inOne, label) => {
    renderPage(true);

    await userEvent.click(within(lineup()).getByRole("button", { name: button }));

    expect(within(lineup()).getByRole("button", { name: `Position I: ${inOne}` })).toBeInTheDocument();
    expect(within(lineup()).getByRole("article", { name: `Set 1, ${label}` })).toBeInTheDocument();
  });

  test("a position's picker suggests the 5-1 role first, and picking a placed player swaps them", async () => {
    const onSave = renderPage(true);

    await userEvent.click(screen.getByRole("button", { name: "Position III: #5 Jana Weiss" }));

    const picker = screen.getByRole("dialog", { name: "Position III" });

    expect(
      within(picker)
        .getAllByRole("button", { pressed: false })
        .map((b) => b.textContent)
    ).toEqual([expect.stringContaining("Ida Berg")]);
    expect(within(picker).queryByText("Mia Kraus")).not.toBeInTheDocument();

    await userEvent.click(within(picker).getByRole("button", { name: "Show everyone else (5)" }));
    expect(within(picker).getByText("Mia Kraus")).toBeInTheDocument();

    await userEvent.click(within(picker).getByRole("button", { name: /Ida Berg/ }));

    expect(screen.getByRole("button", { name: "Position III: #15 Ida Berg" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Position VI: #5 Jana Weiss" })).toBeInTheDocument();
    await waitFor(() => expect(lastSaved(onSave).lineups[0].positions[2]).toBe("p-mb2"));
  });

  test("Leave empty clears a position", async () => {
    const onSave = renderPage(true);

    await userEvent.click(screen.getByRole("button", { name: "Position I: #1 Lena Vogt" }));
    await userEvent.click(screen.getByRole("button", { name: "Leave empty" }));

    expect(screen.getByRole("button", { name: "Position I: empty" })).toBeInTheDocument();
    await waitFor(() => expect(lastSaved(onSave).lineups[0].positions[0]).toBeNull());
  });

  test("the libero picker offers only players off court", async () => {
    const onSave = renderPage(true);

    await userEvent.click(screen.getByRole("button", { name: "Libero: #2 Tess Moor" }));

    const picker = screen.getByRole("dialog", { name: "Libero" });

    await userEvent.click(within(picker).getByRole("button", { name: "Show everyone else (1)" }));
    await userEvent.click(within(picker).getByRole("button", { name: /Kim Roth/ }));

    expect(screen.getByRole("button", { name: "Libero: #17 Kim Roth" })).toBeInTheDocument();
    await waitFor(() => expect(lastSaved(onSave).lineups[0].libero).toBe("p-sub"));
  });

  test("with 5-1 suggestions off, a position's picker lists everyone at once", async () => {
    renderPage(true);

    await userEvent.click(screen.getByRole("button", { name: "5-1 suggestions" }));
    await userEvent.click(screen.getByRole("button", { name: "Position III: #5 Jana Weiss" }));

    const picker = screen.getByRole("dialog", { name: "Position III" });

    expect(within(picker).getAllByRole("button", { pressed: false })).toHaveLength(6);
    expect(within(picker).queryByRole("button", { name: /Show everyone else/ })).not.toBeInTheDocument();
  });

  test("a sub can only be picked from players not yet in the lineup", async () => {
    const onSave = renderPage(true);

    await userEvent.click(screen.getByRole("button", { name: "Add a sub for #4 Mia Kraus" }));

    const picker = screen.getByRole("dialog", { name: "Sub for #4 Mia Kraus" });

    expect(
      within(picker)
        .getAllByRole("button", { pressed: false })
        .map((b) => b.textContent)
    ).toEqual([expect.stringContaining("Kim Roth")]);

    await userEvent.click(within(picker).getByRole("button", { name: /Kim Roth/ }));
    await waitFor(() => expect(lastSaved(onSave).lineups[0].alternates["p-oh1"]).toEqual(["p-sub"]));
  });

  test("dropping a player from the squad clears them from the lineup", async () => {
    const onSave = renderPage(true);

    await userEvent.click(screen.getByRole("button", { name: "Pick squad" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "#1 Lena Vogt" }));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByRole("button", { name: "Position I: empty" })).toBeInTheDocument();
    await waitFor(() => expect(lastSaved(onSave).squad).not.toContain("p-s"));
  });

  test.each([
    ["23", "saves it for this game only", { "p-sub": { number: 23 } }],
    ["4", "flags a number another squad player wears", { "p-sub": { number: 4 } }],
  ])("a one-game number %s %s", async (number, _, overrides) => {
    const onSave = renderPage(true);

    await userEvent.click(screen.getByRole("button", { name: "Pick squad" }));
    await userEvent.click(screen.getByRole("button", { name: "Adjust #17 for this game" }));
    await userEvent.clear(screen.getByRole("textbox", { name: "Number" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Number" }), number);

    await waitFor(() => expect(lastSaved(onSave).overrides).toEqual(overrides));
    expect(screen.queryByText("Also worn by #4 Mia Kraus") !== null).toBe(number === "4");
  });

  test.each([
    ["Print Setter in III", (g: Game) => g.lineups[0].printShifts, [0, 1, 2]],
    ["Print the overview", (g: Game) => g.overview.print, true],
  ])("toggling %s saves it", async (name, read, expected) => {
    const onSave = renderPage(true);

    await userEvent.click(screen.getByRole("button", { name }));

    await waitFor(() => expect(read(lastSaved(onSave))).toEqual(expected));
  });
});

test("the overview places every squad player at their position, outsides in both outside zones", () => {
  renderPage(false);

  const overview = screen.getByRole("article", { name: "Overview" });

  expect(within(overview).getAllByText("Kim Roth")).toHaveLength(2);
  expect(within(overview).getAllByText("Lena Vogt")).toHaveLength(1);
  expect(within(overview).getByText("Tess Moor")).toBeInTheDocument();
});

test("a viewer reads each lineup as its slip and may rotate it, without editing", async () => {
  renderPage(false);

  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Position/ })).not.toBeInTheDocument();
  expect(screen.getByText("Serve short to their #8.")).toBeInTheDocument();

  await userEvent.click(within(lineup()).getByRole("button", { name: "Rotate back (I → II)" }));

  expect(within(lineup()).getByRole("article", { name: "Set 1, Setter in II" })).toBeInTheDocument();
});
