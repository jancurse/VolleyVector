import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AdminPage } from "../../src/admin/AdminPage";
import type { AdminSub } from "../../src/routing/route";
import {
  ACCESS_REQUEST,
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

// Each table heads itself with a search field that narrows its rows as the admin types.
const filterCases = [
  { tab: "Teams", filterLabel: "Filter teams…", query: "insp", matched: "Inspiration", excluded: "My Team" },
  {
    tab: "Accounts",
    filterLabel: "Filter accounts…",
    query: "player",
    matched: OTHER_MEMBER.email,
    excluded: TEST_USER.email,
  },
];

describe("AdminPage", () => {
  test("lists teams, accounts, and grace-archived content across its tabs", async () => {
    const user = await renderPanel();

    // The live team's state; the showcase team (Inspiration) lists alongside it.
    expect(within(screen.getByText("My Team").closest("tr") as HTMLElement).getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inspiration")).toBeInTheDocument();

    await goTab(user, "Accounts");
    expect(screen.getByText(OTHER_MEMBER.email)).toBeInTheDocument();

    // The admin account is flagged and cannot be deleted; a non-admin account offers a delete.
    const adminRow = screen.getByText(TEST_USER.email).closest("tr") as HTMLElement;

    expect(within(adminRow).getByText("Admin")).toBeInTheDocument();
    expect(within(adminRow).queryByRole("button", { name: "Delete account" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete account" })).toBeInTheDocument();

    await goTab(user, "Recovery");
    expect(screen.getByText("Archived Board")).toBeInTheDocument();
    expect(screen.getByText("Archived Note")).toBeInTheDocument();
  });

  test("orders the teams table alphabetically", async () => {
    await renderPanel();

    const inspiration = screen.getByText("Inspiration");
    const myTeam = screen.getByText("My Team");

    expect(inspiration.compareDocumentPosition(myTeam) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test.each(filterCases)("the $tab tab filters its rows by the search field", async (filterCase) => {
    const user = await renderPanel();

    await goTab(user, filterCase.tab);
    expect(screen.getByText(filterCase.excluded)).toBeInTheDocument();

    await user.type(screen.getByLabelText(filterCase.filterLabel), filterCase.query);

    expect(screen.getByText(filterCase.matched)).toBeInTheDocument();
    expect(screen.queryByText(filterCase.excluded)).not.toBeInTheDocument();
  });

  test("archiving a team issues the archive write", async () => {
    const user = await renderPanel();

    const teamRow = screen.getByText("My Team").closest("tr") as HTMLElement;

    await user.click(within(teamRow).getByRole("button", { name: "Archive" }));

    const write = recordedWrites.find((c) => c.table === "teams" && c.op === "update");

    expect(write?.eq).toEqual({ id: TEST_TEAM_ID });
    expect(typeof write?.payload?.archived_at).toBe("string");
  });

  test("deleting a team calls delete_team after confirming", async () => {
    const user = await renderPanel();

    const teamRow = screen.getByText("My Team").closest("tr") as HTMLElement;

    await user.click(within(teamRow).getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");

    await user.click(within(dialog).getByRole("button", { name: "Delete team" }));

    expect(recordedRpcs.find((c) => c.fn === "delete_team")?.params).toEqual({ team: TEST_TEAM_ID });
  });

  test("setting an account's invite quota calls set_invite_quota", async () => {
    const user = await renderPanel();

    await goTab(user, "Accounts");
    const row = screen.getByText(OTHER_MEMBER.email).closest("tr") as HTMLElement;
    const input = within(row).getByLabelText("Invite quota");

    await user.clear(input);
    await user.type(input, "12");
    await user.click(within(row).getByRole("button", { name: "Set" }));

    expect(recordedRpcs.find((c) => c.fn === "set_invite_quota")?.params).toEqual({
      target: OTHER_MEMBER.id,
      value: 12,
    });
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

  test("lists access requests and marks one handled", async () => {
    const user = await renderPanel();

    await goTab(user, "Requests");
    const row = screen.getByText(ACCESS_REQUEST.email).closest("tr") as HTMLElement;

    expect(within(row).getByText(ACCESS_REQUEST.message)).toBeInTheDocument();

    await user.click(within(row).getByRole("button", { name: "Mark handled" }));

    const write = recordedWrites.find((c) => c.table === "access_requests" && c.op === "update");

    expect(write?.eq).toEqual({ id: ACCESS_REQUEST.id });
    expect(typeof write?.payload?.handled_at).toBe("string");
  });

  test("dismissing an access request soft-deletes it", async () => {
    const user = await renderPanel();

    await goTab(user, "Requests");
    const row = screen.getByText(ACCESS_REQUEST.email).closest("tr") as HTMLElement;

    await user.click(within(row).getByRole("button", { name: "Dismiss" }));

    const write = recordedWrites.find((c) => c.table === "access_requests" && c.op === "update");

    expect(write?.eq).toEqual({ id: ACCESS_REQUEST.id });
    expect(typeof write?.payload?.deleted_at).toBe("string");
  });
});
