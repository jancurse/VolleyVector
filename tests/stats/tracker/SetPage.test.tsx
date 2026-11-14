import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { emptyData } from "../../../src/stats/store";
import { writeBackup } from "../../../src/stats/sync/setSync";
import type { SaveOutcome, SetBackend } from "../../../src/stats/sync/setSync";
import { SetPage } from "../../../src/stats/tracker/SetPage";
import { TooltipProvider } from "../../../src/ui/Tooltip";
import { GAME } from "../../helpers/gameData";

vi.mock("../../../src/supabase/client", async () => {
  const mod = await import("../../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

const SET = "set-1";
// A save goes out a second after the last change.
const SAVED = { timeout: 3000 };

/**
 * The server side of saving, the one external dependency here: a set at version 1 whose stats match it, and a
 * scripted answer.
 */
function backend(answer: (base: number) => SaveOutcome = (base) => ({ kind: "saved", version: base + 1 })) {
  const save = vi.fn<SetBackend["save"]>(async ({ base }) => answer(base));
  const publish = vi.fn<SetBackend["publish"]>(async ({ base }) => ({ kind: "saved", version: base }));
  const data = emptyData(["Mira"]);
  const fake: SetBackend = {
    load: async () => ({ kind: "found", record: { id: SET, gameId: GAME.id, version: 1, data, published: data } }),
    save,
    publish,
  };

  return { fake, save, publish };
}

function renderPage(fake: SetBackend, signedIn = true) {
  const handlers = { onBack: vi.fn(), onFinish: vi.fn(async () => {}), onStatsSaved: vi.fn() };

  render(
    <TooltipProvider>
      <SetPage
        setId={SET}
        game={GAME}
        teamName="Eagles"
        finished={false}
        signedIn={signedIn}
        onNextSet={() => {}}
        backend={fake}
        {...handlers}
      />
    </TooltipProvider>
  );

  return handlers;
}

afterEach(() => localStorage.clear());

describe("SetPage", () => {
  test("a change shows as saving, then saved once the server has it", async () => {
    const { fake, save } = backend();

    renderPage(fake);
    expect(await screen.findByText("Stats saved")).toBeInTheDocument();
    await userEvent.keyboard("+");

    await waitFor(() => expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ base: 1 })), SAVED);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"), SAVED);
  });

  test("opening a set saves nothing, though it shows the game's teams and date", async () => {
    const { fake, save, publish } = backend();

    renderPage(fake);

    expect(await screen.findByRole("textbox", { name: "Home" })).toHaveValue("Eagles");
    await new Promise((resolve) => setTimeout(resolve, 1500));

    expect(save).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(screen.getByText("Stats saved")).toBeInTheDocument();
  });

  test("a change stays out of the stats until Save stats, which saves the set and then its stats", async () => {
    const { fake, save, publish } = backend();
    const { onStatsSaved } = renderPage(fake);

    expect(await screen.findByText("Stats saved")).toBeInTheDocument();
    await userEvent.keyboard("+");
    await userEvent.click(screen.getByRole("button", { name: "Save stats" }));

    await waitFor(() => expect(publish).toHaveBeenCalledWith(expect.objectContaining({ id: SET, base: 2 })));
    expect(save).toHaveBeenCalledOnce();
    expect(onStatsSaved).toHaveBeenCalled();
    expect(await screen.findByText("Stats saved")).toBeInTheDocument();
  });

  test("leaving with changes the stats lack asks first", async () => {
    const { fake } = backend();
    const { onBack } = renderPage(fake);

    expect(await screen.findByText("Stats saved")).toBeInTheDocument();
    await userEvent.keyboard("+");
    await userEvent.click(screen.getByRole("button", { name: "Back to the game" }));

    expect(await screen.findByRole("alertdialog", { name: "Leave without saving the stats?" })).toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Leave" }));

    expect(onBack).toHaveBeenCalled();
  });

  test("marking the set finished saves its stats first", async () => {
    const { fake, publish } = backend();
    const { onFinish } = renderPage(fake);

    expect(await screen.findByText("Stats saved")).toBeInTheDocument();
    await userEvent.keyboard("+");
    await userEvent.click(screen.getByRole("button", { name: "Mark set finished" }));

    await waitFor(() => expect(onFinish).toHaveBeenCalledWith(true));
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ id: SET, base: 2 }));
  });

  test("a save someone else beat asks whose changes to keep; keep mine saves over theirs", async () => {
    const { fake, save } = backend((base) =>
      base < 5 ? { kind: "conflict", version: 5, updatedBy: "Pat", updatedAt: "" } : { kind: "saved", version: 6 }
    );

    renderPage(fake);
    expect(await screen.findByText("Stats saved")).toBeInTheDocument();
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

  test("signed out, the tracker stays and says the changes are kept here", async () => {
    renderPage(backend().fake, false);

    expect(await screen.findByText(/You’re signed out/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Stat entry" })).toBeInTheDocument();
  });
});
