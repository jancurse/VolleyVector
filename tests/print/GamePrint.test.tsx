import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";

import { GamePrint } from "../../src/print/GamePrint";
import { GAME, ROSTER } from "../helpers/gameData";

test("prints one slip per chosen version, then the lineup's subs and notes once", () => {
  render(<GamePrint game={GAME} teamName="Eagles" roster={ROSTER} />);

  expect(screen.getByRole("heading", { name: "Cup final" })).toBeInTheDocument();
  expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"))).toEqual([
    "Set 1, Setter in I",
    "Set 1, Setter in II",
  ]);
  expect(screen.getByRole("listitem")).toHaveTextContent("#11 Sara Lind ⇄ #17 Kim Roth");
  expect(screen.getByText("Serve short to their #8.")).toBeInTheDocument();
});

test("leaves out a lineup with no version chosen", () => {
  render(
    <GamePrint
      game={{ ...GAME, lineups: GAME.lineups.map((l) => ({ ...l, printShifts: [] })) }}
      teamName="Eagles"
      roster={ROSTER}
    />
  );

  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(screen.getByText("No lineup has a version chosen to print.")).toBeInTheDocument();
});

test("prints the overview first when chosen, at its saved rotation", () => {
  render(<GamePrint game={{ ...GAME, overview: { print: true, shift: 1 } }} teamName="Eagles" roster={ROSTER} />);

  const [overview] = screen.getAllByRole("article");

  expect(overview).toHaveAccessibleName("Overview");
  expect(within(overview).getByText("Setter in II")).toBeInTheDocument();
});
