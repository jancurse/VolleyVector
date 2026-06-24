import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { InviteAccept } from "../../src/invites/InviteAccept";
import type { InvitePreview } from "../../src/invites/invites";
import type { InvitePreviewState } from "../../src/invites/useInvitePreview";
import { AuthProvider } from "../../src/auth/useAuth";

// The accept body describes whatever rights a link carries and adapts to who opens it. The surface owns
// the preview fetch and passes the resolved state in, so the test constructs the state directly and mocks
// only Supabase auth (the one external dependency), setting the session per test.
let currentSession: { user: { id: string; email: string } } | null = null;
let authCallback: ((event: string, session: typeof currentSession) => void) | null = null;

vi.mock("../../src/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: currentSession }, error: null }),
      onAuthStateChange: (cb: (event: string, session: typeof currentSession) => void) => {
        authCallback = cb;

        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signInWithPassword: () => Promise.resolve({ data: { session: currentSession }, error: null }),
      signOut: () => {
        currentSession = null;
        authCallback?.("SIGNED_OUT", null);

        return Promise.resolve({ error: null });
      },
    },
    functions: { invoke: () => Promise.resolve({ data: { ok: true }, error: null }) },
  },
}));

function ready(preview: InvitePreview): InvitePreviewState {
  return { status: "ready", preview };
}

function renderAccept(
  state: InvitePreviewState,
  props: { initialMode?: "create" | "signin"; onDecline?: () => void } = {}
): void {
  render(
    <AuthProvider>
      <InviteAccept token="t" state={state} {...props} />
    </AuthProvider>
  );
}

beforeEach(() => {
  currentSession = null;
});
afterEach(() => vi.clearAllMocks());

describe("InviteAccept, signed out", () => {
  test("a team account-creation link offers account setup with the clear Sign in / Sign up switch", async () => {
    renderAccept(ready({ allowsNewAccount: true, grantQuota: 0, teamName: "Eagles", role: "coach" }));

    expect(await screen.findByRole("heading", { name: "Join Eagles" })).toBeInTheDocument();
    expect(screen.getByText(/Set up your account to join Eagles as a coach/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join Eagles" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sign up" })).toBeInTheDocument();
  });

  test("switching to the sign-in side asks the existing account to sign in", async () => {
    renderAccept(ready({ allowsNewAccount: true, grantQuota: 0, teamName: "Eagles", role: "coach" }));

    await userEvent.click(await screen.findByRole("tab", { name: "Sign in" }));

    expect(screen.getByText(/Sign in to join Eagles as a coach/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  test("opening on the sign-in side starts there for an account-creation link", async () => {
    renderAccept(ready({ allowsNewAccount: true, grantQuota: 0, teamName: "Eagles", role: "coach" }), {
      initialMode: "signin",
    });

    expect(await screen.findByText(/Sign in to join Eagles as a coach/)).toBeInTheDocument();
  });

  test("a team-less quota link renders quota copy and a plain account setup", async () => {
    renderAccept(ready({ allowsNewAccount: true, grantQuota: 10, teamName: null, role: null }));

    expect(await screen.findByRole("heading", { name: "Claim your invites" })).toBeInTheDocument();
    expect(screen.getByText(/also get 10 invites to bring others on/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });

  test("a team-less account-only link reads Join VolleyVector", async () => {
    renderAccept(ready({ allowsNewAccount: true, grantQuota: 0, teamName: null, role: null }));

    expect(await screen.findByRole("heading", { name: "Join VolleyVector" })).toBeInTheDocument();
  });

  test("an existing-user link offers sign-in only, with no switch", async () => {
    renderAccept(ready({ allowsNewAccount: false, grantQuota: 0, teamName: "Eagles", role: "player" }));

    expect(await screen.findByText(/Sign in to join Eagles as a player/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  test("an invalid link reports it is no longer valid", async () => {
    renderAccept({ status: "invalid" });

    expect(await screen.findByText(/no longer valid/)).toBeInTheDocument();
  });
});

describe("InviteAccept, signed in", () => {
  beforeEach(() => {
    currentSession = { user: { id: "u", email: "me@test" } };
  });

  test("a team link claims the membership in one click", async () => {
    renderAccept(ready({ allowsNewAccount: true, grantQuota: 0, teamName: "Eagles", role: "coach" }));

    expect(await screen.findByText(/This link will join Eagles as a coach/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join Eagles" })).toBeInTheDocument();
  });

  test("a team-less quota link claims the invites in one click", async () => {
    renderAccept(ready({ allowsNewAccount: false, grantQuota: 7, teamName: null, role: null }));

    expect(await screen.findByText(/This link will get 7 invites/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim invites" })).toBeInTheDocument();
  });

  test("an account-only link has nothing to add for an existing account", async () => {
    renderAccept(ready({ allowsNewAccount: true, grantQuota: 0, teamName: null, role: null }));

    expect(await screen.findByText(/nothing to add to your account/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  test("Decline dismisses the claim overlay without redeeming", async () => {
    const onDecline = vi.fn();

    renderAccept(ready({ allowsNewAccount: true, grantQuota: 0, teamName: "Eagles", role: "coach" }), { onDecline });

    await userEvent.click(await screen.findByRole("button", { name: "Decline" }));

    expect(onDecline).toHaveBeenCalledOnce();
  });

  test("signing out returns to account setup so the link can onboard a new account", async () => {
    renderAccept(ready({ allowsNewAccount: true, grantQuota: 0, teamName: "Eagles", role: "coach" }));

    await userEvent.click(await screen.findByRole("button", { name: /Not you\? Sign out/ }));

    expect(await screen.findByText(/Set up your account to join Eagles as a coach/)).toBeInTheDocument();
  });
});
