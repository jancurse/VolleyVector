import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import type { Game, RosterPlayer } from "../../../src/games/types";
import { ImportSetsDialog } from "../../../src/stats/import/ImportSetsDialog";
import { emptyData } from "../../../src/stats/store";
import type { AppData } from "../../../src/stats/types";
import { GAME, ROSTER } from "../../helpers/gameData";

const file: AppData = {
  ...emptyData(["Lena Vogt", "tess moor", "Kim", "Guest"]),
  events: [
    { kind: "touch", id: 1, timestamp: 1, player: "Kim", stat: "serve", result: "ace", zone: "1" },
    { kind: "touch", id: 2, timestamp: 2, player: "Guest", stat: "attack", result: "kill", zone: "4" },
  ],
  meta: { ...emptyData().meta, setNumber: "1", homeTeam: "Opal", awayTeam: "Pumas", date: "2026-10-03" },
};

const guest: RosterPlayer = { ...ROSTER[0]!, id: "p-new", number: 3, name: "Guest", main: "outside" };

/** The dialog with one or more set files chosen and their unmatched player linked, ready to import. */
async function renderImport(
  files: readonly AppData[],
  createSet: (gameId: string, data: AppData, id: string) => Promise<{ error: string | null }>
) {
  const user = userEvent.setup();
  const addPlayers = vi.fn(() => Promise.resolve({ error: null, added: [guest] }));
  const createGame = vi.fn((fields: Pick<Game, "name" | "date" | "opponent" | "venue" | "squad">) =>
    Promise.resolve({ game: { ...GAME, ...fields, id: "g-new" }, error: null })
  );

  render(
    <ImportSetsDialog
      teamName="V3 Pumas"
      games={[]}
      sets={[]}
      roster={ROSTER}
      createGame={createGame}
      saveGame={() => Promise.resolve({ error: null })}
      createSet={createSet}
      addPlayers={addPlayers}
      onClose={() => {}}
    />
  );

  await user.upload(
    screen.getByText("Choose files…").closest("div")!.querySelector("input")!,
    files.map((f, i) => new File([JSON.stringify(f)], `set${i + 1}.json`, { type: "application/json" }))
  );
  await user.click(await screen.findByRole("combobox", { name: "Kim on the roster" }));
  await user.click(await screen.findByRole("option", { name: "Same as #17 Kim Roth" }));

  return { user, addPlayers, createGame };
}

test("a set file fills in a new game and is stored in its terms, with its players linked to the roster", async () => {
  const createSet = vi.fn((_: string, __: AppData, ___: string) => Promise.resolve({ error: null }));
  const { user, addPlayers, createGame } = await renderImport([file], createSet);

  expect(screen.getByLabelText("Game name")).toHaveValue("Opal vs V3 Pumas");
  expect(screen.getByLabelText("Opponent")).toHaveValue("Opal");

  await user.click(screen.getByRole("button", { name: "Import 1 set" }));

  await waitFor(() => expect(createSet).toHaveBeenCalled());
  expect(addPlayers).toHaveBeenCalledWith([
    { number: 3, name: "Guest", shortName: "", main: "outside", secondary: [] },
  ]);
  expect(createGame).toHaveBeenCalledWith({
    name: "Opal vs V3 Pumas",
    date: "2026-10-03",
    opponent: "Opal",
    venue: "away",
    squad: ["p-s", "p-l", "p-sub", "p-new"],
  });

  const stored = createSet.mock.calls[0]![1];

  expect(stored.meta).toMatchObject({ homeTeam: "Opal", awayTeam: "V3 Pumas", date: "2026-10-03" });
  expect(stored.players).toEqual(["Lena Vogt", "Tess Moor", "Kim Roth", "Guest"]);
  expect(stored.events.map((e) => e.kind === "touch" && e.player)).toEqual(["Kim Roth", "Guest"]);
});

test("importing again after a failure saves the rest: no second game, and each set under the id it had", async () => {
  const unnumbered = { ...file, meta: { ...file.meta, setNumber: "" } };
  const createSet = vi
    .fn((_: string, __: AppData, ___: string) => Promise.resolve<{ error: string | null }>({ error: null }))
    .mockResolvedValueOnce({ error: null })
    .mockResolvedValueOnce({ error: "The server took too long to answer." });
  const { user, createGame } = await renderImport([file, unnumbered], createSet);

  await user.click(screen.getByRole("button", { name: "Import 2 sets" }));
  await screen.findByText(/The server took too long to answer/);
  await user.click(screen.getByRole("button", { name: "Import 2 sets" }));
  await waitFor(() => expect(createSet).toHaveBeenCalledTimes(4));

  const [first, failed, firstAgain, retried] = createSet.mock.calls;

  expect(createGame).toHaveBeenCalledTimes(1);
  expect([firstAgain![2], retried![2]]).toEqual([first![2], failed![2]]);
  // The file with no set number takes the game's next free one.
  expect([first![1].meta.setNumber, retried![1].meta.setNumber].sort()).toEqual(["1", "2"]);
});

test("each pick adds to the files chosen, keeping edits, skipping repeats, and a file can be removed", async () => {
  const second = { ...file, meta: { ...file.meta, setNumber: "2" } };
  const { user } = await renderImport([file], () => Promise.resolve({ error: null }));
  const input = screen.getByText("Choose files…").closest("div")!.querySelector("input")!;
  const named = (data: AppData, name: string) => new File([JSON.stringify(data)], name, { type: "application/json" });

  await user.clear(screen.getByLabelText("Game name"));
  await user.type(screen.getByLabelText("Game name"), "Cup final");
  await user.upload(input, [named(second, "other/set2.json"), named(file, "set1.json")]);

  expect(await screen.findByRole("button", { name: "Import 2 sets" })).toBeEnabled();
  expect(screen.getByLabelText("Game name")).toHaveValue("Cup final");

  await user.click(screen.getByRole("button", { name: "Remove set1.json" }));

  expect(screen.getByRole("button", { name: "Import 1 set" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Remove set1.json" })).not.toBeInTheDocument();
});
