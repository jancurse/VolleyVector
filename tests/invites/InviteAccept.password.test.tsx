import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { InviteAccept } from "../../src/invites/InviteAccept";
import type { InvitePreview } from "../../src/invites/invites";
import type { InvitePreviewState } from "../../src/invites/useInvitePreview";
import { AuthProvider } from "../../src/auth/useAuth";

// The account-creation path validates the password client-side (a minimum length and a confirm-match field)
// and gates redemption on Terms acceptance, so a typo cannot create an unusable account and signup always
// records consent. The surface owns the preview fetch, so the test passes the resolved state in and mocks
// only Supabase; the recorded function invocations prove redemption fires only once validation passes.
const invokeCalls: { name: string; body: unknown }[] = [];

vi.mock("../../src/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.resolve({ data: { session: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
    functions: {
      invoke: (name: string, opts: { body: unknown }) => {
        invokeCalls.push({ name, body: opts.body });

        return Promise.resolve({ data: { ok: true }, error: null });
      },
    },
  },
}));

function ready(preview: InvitePreview): InvitePreviewState {
  return { status: "ready", preview };
}

function setUp(): Promise<HTMLElement> {
  render(
    <AuthProvider>
      <InviteAccept
        token="t"
        state={ready({ allowsNewAccount: true, grantQuota: 0, teamName: "Eagles", role: "coach" })}
        initialMode="create"
      />
    </AuthProvider>
  );

  return screen.findByRole("heading", { name: "Join Eagles" });
}

beforeEach(() => {
  invokeCalls.length = 0;
});
afterEach(() => vi.clearAllMocks());

describe("InviteAccept, account-creation password validation", () => {
  const accept = () => userEvent.click(screen.getByRole("checkbox", { name: /Terms & Privacy/i }));

  test("a too-short password is blocked client-side", async () => {
    await setUp();

    await userEvent.type(screen.getByLabelText("Email"), "new@eagles.test");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.type(screen.getByLabelText("Confirm password"), "short");
    await accept();
    await userEvent.click(screen.getByRole("button", { name: "Join Eagles" }));

    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(invokeCalls).toHaveLength(0);
  });

  test("a mismatched confirmation is blocked client-side", async () => {
    await setUp();

    await userEvent.type(screen.getByLabelText("Email"), "new@eagles.test");
    await userEvent.type(screen.getByLabelText("Password"), "longenough1");
    await userEvent.type(screen.getByLabelText("Confirm password"), "longenough2");
    await accept();
    await userEvent.click(screen.getByRole("button", { name: "Join Eagles" }));

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(invokeCalls).toHaveLength(0);
  });

  test("redemption is blocked until the terms are accepted", async () => {
    await setUp();

    await userEvent.type(screen.getByLabelText("Email"), "new@eagles.test");
    await userEvent.type(screen.getByLabelText("Password"), "longenough1");
    await userEvent.type(screen.getByLabelText("Confirm password"), "longenough1");
    await userEvent.click(screen.getByRole("button", { name: "Join Eagles" }));

    expect(invokeCalls).toHaveLength(0);
  });

  test("a valid, matching password reaches redemption", async () => {
    await setUp();

    await userEvent.type(screen.getByLabelText("Email"), "new@eagles.test");
    await userEvent.type(screen.getByLabelText("Password"), "longenough1");
    await userEvent.type(screen.getByLabelText("Confirm password"), "longenough1");
    await accept();
    await userEvent.click(screen.getByRole("button", { name: "Join Eagles" }));

    expect(invokeCalls.some((c) => c.name === "redeem-invite")).toBe(true);
  });
});
