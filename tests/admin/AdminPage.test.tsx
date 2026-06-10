import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AdminPage } from "../../src/admin/AdminPage";
import type { AdminSub } from "../../src/routing/route";
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

// Mock only the external Supabase client; the real hook and page run against it.
vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

beforeEach(() => resetRecorded());
afterEach(() => vi.clearAllMocks());

// The three sub-pages are their own routes, driven by `sub`; a small harness owns it so a tab click
// switches the visible panel exactly as navigation would in the app.
function Harness() {
  const [sub, setSub] = useState<AdminSub>("teams");

  return <AdminPage sub={sub} onNavigateSub={setSub} onCreateTeam={vi.fn()} currentUserId={TEST_USER.id} />;
}

async function renderPanel(): Promise<UserEvent> {
  const user = userEvent.setup();

  render(<Harness />);
  await screen.findByText("My Team"); // the teams tab is the default

  return user;
}

const goTab = (user: UserEvent, name: string) => user.click(screen.getByRole("tab", { name }));

describe("AdminPage", () => {
  test("lists teams, accounts, and grace-archived content across its tabs", async () => {
    const user = await renderPanel();

    expect(screen.getByText("Active")).toBeInTheDocument(); // the live team's state

    await goTab(user, "Accounts");
    expect(screen.getByText(OTHER_MEMBER.email)).toBeInTheDocument();

    // The admin account is flagged and cannot be deleted; a non-admin account offers a delete.
    const adminRow = screen.getByText(TEST_USER.email).closest("tr") as HTMLElement;

    expect(within(adminRow).getByText("Admin")).toBeInTheDocument();
    expect(within(adminRow).queryByRole("button", { name: "Delete account" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete account" })).toBeInTheDocument();

    await goTab(user, "Recovery");
    expect(screen.getByText("Archived Board")).toBeInTheDocument();
    expect(screen.getByText("Archived Topic")).toBeInTheDocument();
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

    await goTab(user, "Accounts");
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    const dialog = await screen.findByRole("alertdialog");

    await user.click(within(dialog).getByRole("button", { name: "Delete account" }));

    expect(recordedInvokes.find((c) => c.name === "delete-account")?.body).toEqual({ userId: OTHER_MEMBER.id });
  });

  test("restoring grace-archived content clears its deleted_at", async () => {
    const user = await renderPanel();

    await goTab(user, "Recovery");
    const row = screen.getByText("Archived Board").closest("tr") as HTMLElement;

    await user.click(within(row).getByRole("button", { name: "Restore" }));

    const write = recordedWrites.find((c) => c.table === "boards" && c.op === "update");

    expect(write?.payload?.deleted_at).toBeNull();
  });

  test("restoring a deleted team clears the team's deleted_at", async () => {
    const user = await renderPanel();

    await goTab(user, "Recovery");
    const row = screen.getByText(DELETED_TEAM.name).closest("tr") as HTMLElement;

    await user.click(within(row).getByRole("button", { name: "Restore" }));

    const write = recordedWrites.find((c) => c.table === "teams" && c.op === "update");

    expect(write?.eq).toEqual({ id: DELETED_TEAM.id });
    expect(write?.payload?.deleted_at).toBeNull();
  });

  test("restoring a deleted account invokes the restore-account function", async () => {
    const user = await renderPanel();

    await goTab(user, "Recovery");
    const row = screen.getByText(DELETED_ACCOUNT.email).closest("tr") as HTMLElement;

    await user.click(within(row).getByRole("button", { name: "Restore" }));

    expect(recordedInvokes.find((c) => c.name === "restore-account")?.body).toEqual({ userId: DELETED_ACCOUNT.id });
  });
});
