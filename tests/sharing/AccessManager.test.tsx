import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AccessManager } from "../../src/sharing/AccessManager";
import { SAMPLE_BOARDS } from "../helpers/sampleData";
import {
  OTHER_MEMBER,
  recordedRpcs,
  recordedWrites,
  resetRecorded,
  TEST_TEAM_ID,
  TEST_USER,
} from "../helpers/supabaseFake";

// Mock only the external Supabase client; the real component runs against it.
vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

beforeEach(() => resetRecorded());
afterEach(() => vi.clearAllMocks());

// SAMPLE_BOARDS[0]'s only seeded grant is the team-owner grant for TEST_TEAM_ID, so the writes below target it.
const board = SAMPLE_BOARDS[0];
const teamGrantId = `ba-${board.id}-${TEST_TEAM_ID}`;
// Stable arrays, so the candidate-loading effect (keyed on the member teams) runs once per render.
const teams = [{ teamId: TEST_TEAM_ID, teamName: "My Team", slug: "my-team" }];

function renderManager() {
  return render(
    <AccessManager
      open
      onOpenChange={() => {}}
      board={board}
      coachedTeams={teams}
      memberTeams={teams}
      teamName={() => "My Team"}
      currentUserId={TEST_USER.id}
    />
  );
}

const findWrite = (table: string, op: "insert" | "update" | "delete") =>
  waitFor(() => {
    const write = recordedWrites.find((c) => c.table === table && c.op === op);

    expect(write).toBeDefined();

    return write!;
  });

describe("AccessManager", () => {
  test("the add picker scopes to teammates, named by display name not email", async () => {
    const user = userEvent.setup();

    renderManager();

    // The teammate from the caller's team is offered (by display name); their email never appears. The
    // picker's accessible name is its "Add a person or team" aria-label.
    await user.click((await screen.findAllByRole("combobox", { name: "Add a person or team" }))[0]);
    expect(await screen.findByRole("option", { name: "Player Pat" })).toBeInTheDocument();
    expect(screen.queryByText(OTHER_MEMBER.email)).not.toBeInTheDocument();
  });

  test("adding a teammate writes a single user grant at the default capability", async () => {
    const user = userEvent.setup();

    renderManager();

    await user.click((await screen.findAllByRole("combobox", { name: "Add a person or team" }))[0]);
    await user.click(await screen.findByRole("option", { name: "Player Pat" }));
    await user.click(screen.getByRole("button", { name: "Add" }));

    const insert = await findWrite("board_access", "insert");

    expect(insert.payload).toEqual({
      board_id: board.id,
      user_id: OTHER_MEMBER.id,
      team_id: null,
      capability: "editor",
    });
  });

  test("changing a grant's capability targets that grant by id", async () => {
    const user = userEvent.setup();

    renderManager();

    await user.click(await screen.findByRole("combobox", { name: "Capability for My Team (team)" }));
    await user.click(await screen.findByRole("option", { name: "Viewer" }));

    const update = await findWrite("board_access", "update");

    expect(update.payload).toEqual({ capability: "viewer" });
    expect(update.eq.id).toBe(teamGrantId);
  });

  test("removing a grant deletes it by id only after confirming", async () => {
    const user = userEvent.setup();

    renderManager();

    await user.click(await screen.findByRole("button", { name: "Remove access" }));

    // The trash icon opens a confirm dialog; nothing is deleted until the destructive action is confirmed.
    const dialog = await screen.findByRole("alertdialog");

    // The seeded grant is the only one, so removing it archives the board: the warning names that.
    expect(within(dialog).getByText(/last access to this board, so removing it archives it/i)).toBeInTheDocument();
    expect(recordedWrites.some((c) => c.table === "board_access" && c.op === "delete")).toBe(false);

    await user.click(within(dialog).getByRole("button", { name: "Remove" }));

    const del = await findWrite("board_access", "delete");

    expect(del.eq.id).toBe(teamGrantId);
  });

  test("cancelling the remove confirm does not delete the grant", async () => {
    const user = userEvent.setup();

    renderManager();

    await user.click(await screen.findByRole("button", { name: "Remove access" }));

    const dialog = await screen.findByRole("alertdialog");

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(recordedWrites.some((c) => c.table === "board_access" && c.op === "delete")).toBe(false);
  });

  test("shows a loading placeholder until the access list resolves", async () => {
    renderManager();

    // The grants start empty; the manager shows Loading… rather than rendering an empty list as "nobody".
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
    expect(await screen.findByText("Who has access")).toBeInTheDocument();
  });

  test("sharing by exact email calls the resolve-and-grant RPC and confirms the same for any address", async () => {
    const user = userEvent.setup();

    renderManager();

    await user.type(await screen.findByRole("textbox", { name: "By email" }), "stranger@example.com");
    await user.click(screen.getByRole("button", { name: "Share" }));

    // The reply is uniform whether or not an account matched (no account-existence oracle): the RPC is
    // called with the address and a fixed confirmation shows, and no email is rendered back.
    await waitFor(() => expect(recordedRpcs.some((c) => c.fn === "grant_board_by_email")).toBe(true));
    const call = recordedRpcs.find((c) => c.fn === "grant_board_by_email");

    expect(call?.params).toMatchObject({ board: board.id, addr: "stranger@example.com", cap: "viewer" });
    expect(await screen.findByText(/it can now view this board/i)).toBeInTheDocument();
  });

  test("the share link mints a single-use link and copies it to the clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    renderManager();

    await user.click(await screen.findByRole("button", { name: "Copy share link" }));

    const insert = await findWrite("access_links", "insert");

    expect(insert.payload).toMatchObject({ board_id: board.id, capability: "viewer" });
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });
});
