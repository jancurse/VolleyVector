import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AdminManager } from "../../src/admin/AdminManager";
import {
  DELETED_ACCOUNT,
  DELETED_TEAM,
  OTHER_MEMBER,
  recordedInvokes,
  recordedRpcs,
  recordedWrites,
  resetRecorded,
  TEST_TEAM_ID,
  TEST_USER,
} from "../helpers/supabaseFake";

// Mock only the external Supabase client; the real hook and component run against it.
vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

beforeEach(() => resetRecorded());
afterEach(() => vi.clearAllMocks());

async function renderPanel(): Promise<UserEvent> {
  const user = userEvent.setup();

  render(<AdminManager open onOpenChange={() => {}} onCreateTeam={vi.fn()} currentUserId={TEST_USER.id} />);
  await screen.findByText("My Team");

  return user;
}

describe("AdminManager", () => {
  test("lists teams, accounts, and grace-archived content", async () => {
    await renderPanel();

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText(OTHER_MEMBER.email)).toBeInTheDocument();
    expect(screen.getByText("Archived Board")).toBeInTheDocument();
    expect(screen.getByText("Archived Topic")).toBeInTheDocument();

    // The admin account is flagged and cannot be deleted; a non-admin account offers a delete.
    const adminRow = screen.getByText(TEST_USER.email).closest("li") as HTMLElement;

    expect(within(adminRow).getByText("Admin")).toBeInTheDocument();
    expect(within(adminRow).queryByRole("button", { name: "Delete account" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete account" })).toBeInTheDocument();
  });

  test("archiving a team issues the archive write", async () => {
    const user = await renderPanel();

    await user.click(screen.getByRole("button", { name: "Archive" }));

    const write = recordedWrites.find((c) => c.table === "teams" && c.op === "update");

    expect(write?.eq).toEqual({ id: TEST_TEAM_ID });
    expect(typeof write?.payload?.archived_at).toBe("string");
  });

  test("deleting a team calls delete_team after confirming", async () => {
    const user = await renderPanel();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");

    await user.click(within(dialog).getByRole("button", { name: "Delete team" }));

    expect(recordedRpcs.find((c) => c.fn === "delete_team")?.params).toEqual({ team: TEST_TEAM_ID });
  });

  test("deleting an account invokes the delete-account function after confirming", async () => {
    const user = await renderPanel();

    await user.click(screen.getByRole("button", { name: "Delete account" }));
    const dialog = await screen.findByRole("alertdialog");

    await user.click(within(dialog).getByRole("button", { name: "Delete account" }));

    expect(recordedInvokes.find((c) => c.name === "delete-account")?.body).toEqual({ userId: OTHER_MEMBER.id });
  });

  test("restoring grace-archived content clears its deleted_at", async () => {
    const user = await renderPanel();

    const row = screen.getByText("Archived Board").closest("li") as HTMLElement;

    await user.click(within(row).getByRole("button", { name: "Restore" }));

    const write = recordedWrites.find((c) => c.table === "boards" && c.op === "update");

    expect(write?.payload?.deleted_at).toBeNull();
  });

  test("restoring a deleted team clears the team's deleted_at", async () => {
    const user = await renderPanel();

    const row = screen.getByText(DELETED_TEAM.name).closest("li") as HTMLElement;

    await user.click(within(row).getByRole("button", { name: "Restore" }));

    const write = recordedWrites.find((c) => c.table === "teams" && c.op === "update");

    expect(write?.eq).toEqual({ id: DELETED_TEAM.id });
    expect(write?.payload?.deleted_at).toBeNull();
  });

  test("restoring a deleted account invokes the restore-account function", async () => {
    const user = await renderPanel();

    const row = screen.getByText(DELETED_ACCOUNT.email).closest("li") as HTMLElement;

    await user.click(within(row).getByRole("button", { name: "Restore" }));

    expect(recordedInvokes.find((c) => c.name === "restore-account")?.body).toEqual({ userId: DELETED_ACCOUNT.id });
  });
});
