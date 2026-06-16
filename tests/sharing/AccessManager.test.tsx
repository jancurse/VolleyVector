import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AccessManager } from "../../src/sharing/AccessManager";
import { SAMPLE_BOARDS } from "../helpers/sampleData";
import { OTHER_MEMBER, recordedWrites, resetRecorded, TEST_TEAM_ID, TEST_USER } from "../helpers/supabaseFake";

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

function renderManager() {
  return render(
    <AccessManager
      open
      onOpenChange={() => {}}
      board={board}
      coachedTeams={[{ teamId: TEST_TEAM_ID, teamName: "My Team", slug: "my-team" }]}
      teamName={() => "My Team"}
      currentUserId={TEST_USER.id}
    />
  );
}

const findWrite = (op: "insert" | "update" | "delete") =>
  waitFor(() => {
    const write = recordedWrites.find((c) => c.table === "board_access" && c.op === op);

    expect(write).toBeDefined();

    return write!;
  });

describe("AccessManager", () => {
  test("adding a teammate writes a single user grant at the default capability", async () => {
    const user = userEvent.setup();

    renderManager();

    // The team is already granted, so the add form appears only once the profiles load its user options. Both
    // add-form Selects are labelled "Add access" by their Field; the first is the principal picker.
    await user.click((await screen.findAllByRole("combobox", { name: "Add access" }))[0]);
    await user.click(await screen.findByRole("option", { name: "Player Pat" }));
    await user.click(screen.getByRole("button", { name: "Add" }));

    const insert = await findWrite("insert");

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

    const update = await findWrite("update");

    expect(update.payload).toEqual({ capability: "viewer" });
    expect(update.eq.id).toBe(teamGrantId);
  });

  test("removing a grant deletes it by id", async () => {
    const user = userEvent.setup();

    renderManager();

    // The team grant is not the caller's own, so its action reads as "Remove access" rather than "Leave".
    await user.click(await screen.findByRole("button", { name: "Remove access" }));

    const del = await findWrite("delete");

    expect(del.eq.id).toBe(teamGrantId);
  });
});
