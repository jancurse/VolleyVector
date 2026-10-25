import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";

import { GamePrint } from "../../src/print/GamePrint";
import type { Game } from "../../src/games/types";
import { GAME, ROSTER } from "../helpers/gameData";

const renderPrint = (game: Game = GAME) =>
  render(<GamePrint game={game} teamName="Eagles" roster={ROSTER} onBack={() => {}} />);

const articles = () => screen.queryAllByRole("article").map((a) => a.getAttribute("aria-label"));
const ROTATIONS = ["Set 1, Setter in I", "Set 1, Setter in II"];

test.each([
  [[], true, ["Overview", ...ROTATIONS]],
  [["Print the squad"], false, ["Overview", ...ROTATIONS]],
  [["Print the overview"], true, ROTATIONS],
  [["Print the squad", "Print the overview"], false, ROTATIONS],
])("with %o switched off, the squad shows (%s) and the slips are %o", async (off, squad, printed) => {
  renderPrint();

  for (const name of off) await userEvent.click(screen.getByRole("button", { name }));

  expect(screen.queryByRole("heading", { name: "Squad" }) !== null).toBe(squad);
  expect(articles()).toEqual(printed);
});

test("prints the overview at its saved shift and each rotation's subs and notes once", () => {
  renderPrint({ ...GAME, overviewShift: 1 });

  expect(within(screen.getByRole("article", { name: "Overview" })).getByText("Setter in II")).toBeInTheDocument();
  expect(screen.getByText("Serve short to their #8.")).toBeInTheDocument();
  expect(screen.getByText("Planned subs").nextElementSibling).toHaveTextContent("#11 Sara Lind ⇄ #17 Kim Roth");
});

test("leaves out a rotation with no version chosen", () => {
  renderPrint({ ...GAME, rotations: GAME.rotations.map((l) => ({ ...l, printShifts: [] })) });

  expect(articles()).toEqual(["Overview"]);
  expect(screen.getByText("No rotation has a version chosen to print.")).toBeInTheDocument();
});
