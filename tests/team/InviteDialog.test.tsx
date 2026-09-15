import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { InviteDialog } from "../../src/team/InviteDialog";

// The dialog runs against a mocked Supabase client (the one external dependency): `invite_availability`
// returns the caller's remaining quota, the `invites` insert records the minted row and hands back a token,
// and the `send-invite` Edge Function records its call and returns the success or failure set per test. The
// "By link" and "By email" paths are exercised through these.
type InvokeError = { message: string; context: { json: () => Promise<{ error: string }> } };

let available: number | null = 5;
let inviteError: InvokeError | null = null;
const invokeCalls: { name: string; body: unknown }[] = [];
const mintedInvites: Record<string, unknown>[] = [];

vi.mock("../../src/supabase/client", () => ({
  supabase: {
    rpc: (fn: string) =>
      Promise.resolve(fn === "invite_availability" ? { data: available, error: null } : { data: null, error: null }),
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        mintedInvites.push(row);

        return {
          select: () => ({ single: () => Promise.resolve({ data: { token: "tok" }, error: null }) }),
        };
      },
    }),
    functions: {
      invoke: (name: string, opts: { body: unknown }) => {
        invokeCalls.push({ name, body: opts.body });

        return Promise.resolve(inviteError ? { data: null, error: inviteError } : { data: { ok: true }, error: null });
      },
    },
  },
}));

const team = { teamId: "t1", teamName: "Eagles" };

function renderDialog(props: Partial<Parameters<typeof InviteDialog>[0]> = {}) {
  render(<InviteDialog open onOpenChange={() => {}} isAdmin={false} currentUserId="me" team={team} {...props} />);
}

beforeEach(() => {
  available = 5;
  inviteError = null;
  invokeCalls.length = 0;
  mintedInvites.length = 0;
});

const USES = "How many people may use the link";

describe("InviteDialog, By link", () => {
  test("mints a single-use link by default", async () => {
    renderDialog();

    await waitFor(() => expect(screen.getByRole("button", { name: "Create invite link" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Create invite link" }));

    expect(mintedInvites).toEqual([
      {
        created_by: "me",
        allows_new_account: true,
        grant_quota: 0,
        team_id: "t1",
        role: "player",
        max_uses: 1,
      },
    ]);
    expect(await screen.findByText("Single-use, expires in 7 days.")).toBeInTheDocument();
  });

  test("mints a link for the chosen number of uses, spending a slot each", async () => {
    renderDialog();

    const uses = await screen.findByLabelText(USES);

    await userEvent.clear(uses);
    await userEvent.type(uses, "5");
    await userEvent.click(screen.getByRole("button", { name: "Create invite link" }));

    expect(mintedInvites[0]).toMatchObject({ max_uses: 5, allows_new_account: true });
    expect(await screen.findByText("Usable 5 times, expires in 7 days.")).toBeInTheDocument();
  });

  test("blocks a link asking for more uses than the quota covers", async () => {
    renderDialog();

    const uses = await screen.findByLabelText(USES);

    await userEvent.clear(uses);
    await userEvent.type(uses, "6");

    expect(await screen.findByText("Only 5 invites left.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create invite link" })).toBeDisabled();
    expect(mintedInvites).toHaveLength(0);
  });

  test("leaves an existing-user link ungated, however many uses it carries", async () => {
    available = 0;
    renderDialog();

    const uses = await screen.findByLabelText(USES);

    await userEvent.clear(uses);
    await userEvent.type(uses, "12");
    await userEvent.click(screen.getByRole("button", { name: "Create invite link" }));

    expect(mintedInvites[0]).toMatchObject({ max_uses: 12, allows_new_account: false });
  });
});

describe("InviteDialog, By email", () => {
  test.each([
    { kind: "the sent confirmation on success", error: null, expected: "Invite sent to coach@eagles.test." },
    {
      kind: "the returned error on failure",
      error: { message: "x", context: { json: () => Promise.resolve({ error: "Server says no" }) } },
      expected: "Server says no",
    },
  ])("sends to the address, team, and role, then shows $kind", async ({ error, expected }) => {
    inviteError = error;
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "By email" }));
    await userEvent.type(screen.getByRole("textbox"), "coach@eagles.test");

    const send = screen.getByRole("button", { name: "Send invite" });

    await waitFor(() => expect(send).toBeEnabled());
    await userEvent.click(send);

    expect(invokeCalls).toEqual([
      { name: "send-invite", body: { email: "coach@eagles.test", teamId: "t1", role: "player" } },
    ]);
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  test("sends a team-less invite (null team and role) when no team is selected", async () => {
    renderDialog({ team: null });

    await userEvent.click(screen.getByRole("button", { name: "By email" }));
    await userEvent.type(screen.getByRole("textbox"), "newbie@example.test");

    const send = screen.getByRole("button", { name: "Send invite" });

    await waitFor(() => expect(send).toBeEnabled());
    await userEvent.click(send);

    expect(invokeCalls).toEqual([
      { name: "send-invite", body: { email: "newbie@example.test", teamId: null, role: null } },
    ]);
    expect(await screen.findByText("Invite sent to newbie@example.test.")).toBeInTheDocument();
  });

  test("disables Send when no invites remain", async () => {
    available = 0;
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "By email" }));
    await userEvent.type(screen.getByRole("textbox"), "x@y.test");

    expect(await screen.findByText("No invites left.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send invite" })).toBeDisabled();
    expect(invokeCalls).toHaveLength(0);
  });
});
