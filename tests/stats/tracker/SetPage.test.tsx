import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { emptyData } from "../../../src/stats/store";
import { writeBackup } from "../../../src/stats/sync/setSync";
import type { SaveOutcome, SetBackend } from "../../../src/stats/sync/setSync";
import { SetPage } from "../../../src/stats/tracker/SetPage";
import type { AppData } from "../../../src/stats/types";
import { TooltipProvider } from "../../../src/ui/Tooltip";
import { GAME } from "../../helpers/gameData";

vi.mock("../../../src/supabase/client", async () => {
  const mod = await import("../../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

const SET = "set-1";
// A save goes out a second after the last change.
const SAVED = { timeout: 3000 };

/** The server side of saving, the one external dependency here: a set at version 1 and a scripted answer. */
function backend(
  answer: (base: number) => SaveOutcome = (base) => ({ kind: "saved", version: base + 1 }),
  data: AppData = emptyData(["Mira"])
) {
  const save = vi.fn<SetBackend["save"]>(async ({ base }) => answer(base));
  const publish = vi.fn<SetBackend["publish"]>(async ({ base }) => ({ kind: "saved", version: base }));
  const fake: SetBackend = {
    load: async () => ({ kind: "found", record: { id: SET, gameId: GAME.id, version: 1, data } }),
    save,
    publish,
  };

  return { fake, save, publish };
}

function renderPage(fake: SetBackend, signedIn = true, finished = false) {
  const onFinish = vi.fn<(finished: boolean) => Promise<boolean>>(async () => true);

  render(
    <TooltipProvider>
      <SetPage
        setId={SET}
        game={GAME}
        teamName="Eagles"
        finished={finished}
        signedIn={signedIn}
        onBack={() => {}}
        onNextSet={() => {}}
        onFinish={onFinish}
        onStatsSaved={() => {}}
        backend={fake}
      />
    </TooltipProvider>
  );

  return { onFinish };
}

afterEach(() => localStorage.clear());

describe("SetPage", () => {
  test("a change shows as saving, then saved once the server has it", async () => {
    const { fake, save } = backend();

    renderPage(fake);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"), SAVED);
    await userEvent.keyboard("+");

    await waitFor(() => expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ base: 1 })), SAVED);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"), SAVED);
  });

  test("a save someone else beat asks whose changes to keep; keep mine saves over theirs", async () => {
    const { fake, save } = backend((base) =>
      base < 5 ? { kind: "conflict", version: 5, updatedBy: "Pat", updatedAt: "" } : { kind: "saved", version: 6 }
    );

    renderPage(fake);
    await screen.findByRole("status");
    await userEvent.keyboard("+");

    expect(await screen.findByText(/Pat saved this set/, {}, SAVED)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("changed elsewhere");

    await userEvent.click(screen.getByRole("button", { name: "Keep mine (overwrite)" }));

    await waitFor(() => expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ base: 5 })), SAVED);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"), SAVED);
  });

  test("a local copy made on an older version asks which to keep before opening", async () => {
    const { fake, save } = backend();

    writeBackup(localStorage, SET, { gameId: GAME.id, baseVersion: 0, data: emptyData(["Mira", "Suki"]) });
    URL.createObjectURL = () => "blob:copy";
    URL.revokeObjectURL = () => {};
    renderPage(fake);

    expect(await screen.findByRole("dialog", { name: "This set changed in two places" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Keep this browser’s" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ base: 1 })), SAVED);
    expect(save.mock.calls[0][0].data.players).toEqual(["Mira", "Suki"]);
  });

  test("Done puts the changes in the stats, marks the set finished, and locks it, even with every event removed", async () => {
    const { fake, publish } = backend();
    const { onFinish } = renderPage(fake);

    await screen.findByRole("status");
    expect(screen.getByRole("button", { name: "Done" })).toBeDisabled();
    await userEvent.keyboard("+");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() => expect(onFinish).toHaveBeenLastCalledWith(true), SAVED);
    expect(publish).toHaveBeenCalledTimes(1);

    await userEvent.click(await screen.findByRole("button", { name: "Edit set" }));
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByText("Not in the stats yet", {}, SAVED)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() => expect(publish).toHaveBeenCalledTimes(2), SAVED);
  });

  test("a finished set with stats opens locked, and Edit set takes its finished mark back first", async () => {
    const recorded: AppData = {
      ...emptyData(["Mira"]),
      events: [{ kind: "point", id: 1, timestamp: 1, winner: "us" }],
    };
    const { onFinish } = renderPage(backend(undefined, recorded).fake, true, true);

    await userEvent.click(await screen.findByRole("button", { name: "Edit set" }));

    await waitFor(() => expect(onFinish).toHaveBeenCalledWith(false));
    expect(await screen.findByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  test("signed out, the tracker stays and says the changes are kept here", async () => {
    renderPage(backend().fake, false);

    expect(await screen.findByText(/You’re signed out/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Stat entry" })).toBeInTheDocument();
  });
});
