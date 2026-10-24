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

describe("GamePage as a coach", () => {
  test("a new lineup starts as a 5-1 with the setter in I and saves itself", async () => {
    const onSave = renderPage(true, { ...GAME, lineups: [] });

    await userEvent.click(screen.getByRole("button", { name: "Add lineup" }));

    const lineup = screen.getByRole("region", { name: "Lineup 1" });

    expect(within(lineup).getByRole("combobox", { name: "Position I" })).toHaveTextContent("#1 Lena Vogt");
    expect(within(lineup).getByRole("combobox", { name: "Libero" })).toHaveTextContent("#2 Tess Moor");
    await waitFor(() => expect(lastSaved(onSave).lineups[0].positions[0]).toBe("p-s"));
  });

  test.each([
    ["Rotate forward (II → I)", "#4 Mia Kraus", "Setter in VI"],
    ["Rotate back (I → II)", "#15 Ida Berg", "Setter in II"],
  ])("%s moves everyone one position", async (button, inOne, label) => {
    renderPage(true);

    await userEvent.click(screen.getByRole("button", { name: button }));

    expect(screen.getByRole("combobox", { name: "Position I" })).toHaveTextContent(inOne);
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  test("dropping a player from the squad clears them from the lineup", async () => {
    const onSave = renderPage(true);

    await userEvent.click(screen.getByRole("button", { name: "#1 Lena Vogt" }));

    expect(screen.getByRole("combobox", { name: "Position I" })).toHaveTextContent("Empty");
    await waitFor(() => expect(lastSaved(onSave).squad).not.toContain("p-s"));
  });

  test("choosing a print version saves it", async () => {
    const onSave = renderPage(true);

    await userEvent.click(screen.getByRole("button", { name: "Print Setter in III" }));

    await waitFor(() => expect(lastSaved(onSave).lineups[0].printShifts).toEqual([0, 1, 2]));
  });
});

test("a viewer reads each lineup as its slip, with subs and notes", () => {
  renderPage(false);

  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.getByRole("article", { name: "Set 1, Setter in I" })).toBeInTheDocument();
  expect(screen.getByText("Serve short to their #8.")).toBeInTheDocument();
});
