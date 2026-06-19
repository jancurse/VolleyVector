import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { InviteAccept } from "../../src/invites/InviteAccept";
import { AuthProvider } from "../../src/auth/useAuth";

// The accept screen describes whatever rights a link carries and adapts to who opens it. It runs against a
// mocked Supabase client (the one external dependency): the preview rows and the session are set per test
// so each combination of grants — a team, a quota grant, account creation, team-less — can be exercised.
type PreviewRow = { allows_new_account: boolean; grant_quota: number; team_name: string | null; role: string | null };

let previewRows: PreviewRow[] = [];
let currentSession: { user: { id: string; email: string } } | null = null;

vi.mock("../../src/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: currentSession }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.resolve({ data: { session: currentSession }, error: null }),
    },
    rpc: (fn: string) =>
      Promise.resolve(fn === "invite_preview" ? { data: previewRows, error: null } : { data: null, error: null }),
    functions: { invoke: () => Promise.resolve({ data: { ok: true }, error: null }) },
  },
}));

function renderAccept() {
  render(
    <AuthProvider>
      <InviteAccept token="t" />
    </AuthProvider>
  );
}

beforeEach(() => {
  previewRows = [];
  currentSession = null;
});
afterEach(() => vi.clearAllMocks());

describe("InviteAccept, signed out", () => {
  test("a team account-creation link offers account setup, scoped to the team", async () => {
    previewRows = [{ allows_new_account: true, grant_quota: 0, team_name: "Eagles", role: "coach" }];
    renderAccept();

    expect(await screen.findByRole("heading", { name: "Join Eagles" })).toBeInTheDocument();
    expect(screen.getByText(/Set up your account to join Eagles as a coach/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join Eagles" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Already have an account/ })).toBeInTheDocument();
  });

  test("a team-less quota link renders quota copy and a plain account setup", async () => {
    previewRows = [{ allows_new_account: true, grant_quota: 10, team_name: null, role: null }];
    renderAccept();

    expect(await screen.findByRole("heading", { name: "Claim your invites" })).toBeInTheDocument();
    expect(screen.getByText(/also get 10 invites to bring others on/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });

  test("a team-less account-only link reads Join VolleyCoach", async () => {
    previewRows = [{ allows_new_account: true, grant_quota: 0, team_name: null, role: null }];
    renderAccept();

    expect(await screen.findByRole("heading", { name: "Join VolleyCoach" })).toBeInTheDocument();
  });

  test("an existing-user link offers sign-in only, with no account setup", async () => {
    previewRows = [{ allows_new_account: false, grant_quota: 0, team_name: "Eagles", role: "player" }];
    renderAccept();

    expect(await screen.findByText(/Sign in to join Eagles as a player/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Set up an account/ })).not.toBeInTheDocument();
  });
});

describe("InviteAccept, signed in", () => {
  beforeEach(() => {
    currentSession = { user: { id: "u", email: "me@test" } };
  });

  test("a team link claims the membership in one click", async () => {
    previewRows = [{ allows_new_account: true, grant_quota: 0, team_name: "Eagles", role: "coach" }];
    renderAccept();

    expect(await screen.findByText(/This link will join Eagles as a coach/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join Eagles" })).toBeInTheDocument();
  });

  test("a team-less quota link claims the invites in one click", async () => {
    previewRows = [{ allows_new_account: false, grant_quota: 7, team_name: null, role: null }];
    renderAccept();

    expect(await screen.findByText(/This link will get 7 invites/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim invites" })).toBeInTheDocument();
  });

  test("an account-only link has nothing to add for an existing account", async () => {
    previewRows = [{ allows_new_account: true, grant_quota: 0, team_name: null, role: null }];
    renderAccept();

    expect(await screen.findByText(/nothing to add to your account/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });
});
