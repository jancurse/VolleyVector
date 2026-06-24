import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { App } from "../../src/App";
import { LandingPage } from "../../src/landing/LandingPage";
import { AuthProvider } from "../../src/auth/useAuth";
import { recordedInvokes, resetRecorded, supabaseFake } from "../helpers/supabaseFake";

// The landing page floats one shared auth surface behind every door (Sign in, Sign up, Accept invite),
// each reusing the real login form, request-access form, or invite-accept flow through the Supabase
// client. So mock only the external client; everything else runs for real.
vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

beforeEach(() => {
  resetRecorded();
  localStorage.clear();
  window.location.hash = "";
  window.history.replaceState(null, "", "/");
});
afterEach(() => vi.restoreAllMocks());

function renderLanding(theme: "light" | "dark" = "light", onSetTheme = vi.fn(), inviteToken: string | null = null) {
  return render(
    <AuthProvider>
      <LandingPage theme={theme} onSetTheme={onSetTheme} inviteToken={inviteToken} />
    </AuthProvider>
  );
}

describe("the landing page", () => {
  test("leads with a text hero, then the example boards below", () => {
    renderLanding();

    expect(screen.getByRole("heading", { level: 1, name: /Build the play/ })).toBeInTheDocument();
    // The actual Court renders the real boards' markers — not a screenshot or a mock.
    expect(screen.getAllByRole("img", { name: "Setter" }).length).toBeGreaterThan(0);
    // The example boards carry their own titles; no marketing subtitle wraps them.
    expect(screen.getByRole("heading", { name: "Base defence" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Set a system, share the picture." })).not.toBeInTheDocument();
  });

  test("offers Try it as the hero action, with a single Sign in in the header", () => {
    renderLanding();

    expect(screen.getAllByRole("button", { name: "Try it" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign up" })).not.toBeInTheDocument();
  });

  test("Sign in opens the shared surface on the sign-in side", async () => {
    const user = userEvent.setup();

    renderLanding();
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const dialog = await screen.findByRole("dialog", { name: "Sign in or sign up" });

    expect(within(dialog).getByRole("tab", { name: "Sign in", selected: true })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Email")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Password")).toBeInTheDocument();
  });

  test("the Sign up tab shows the invite-only request form", async () => {
    const user = userEvent.setup();

    renderLanding();
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const dialog = await screen.findByRole("dialog", { name: "Sign in or sign up" });

    await user.click(within(dialog).getByRole("tab", { name: "Sign up" }));
    expect(within(dialog).getByRole("tab", { name: "Sign up", selected: true })).toBeInTheDocument();
    expect(within(dialog).getByText(/invite-only/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Request access" })).toBeInTheDocument();
  });

  test("the in-surface switch toggles between sign in and sign up", async () => {
    const user = userEvent.setup();

    renderLanding();
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText("Password")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("tab", { name: "Sign up" }));
    expect(within(dialog).getByRole("button", { name: "Request access" })).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Password")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("tab", { name: "Sign in" }));
    expect(within(dialog).getByLabelText("Password")).toBeInTheDocument();
  });

  test("the request-access form submits the email and optional message", async () => {
    const user = userEvent.setup();

    renderLanding();
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("tab", { name: "Sign up" }));
    await user.type(within(dialog).getByLabelText("Email"), "hopeful@example.com");
    await user.type(within(dialog).getByLabelText(/Message/), "Coach Casey sent me");
    await user.click(within(dialog).getByRole("button", { name: "Request access" }));

    expect(recordedInvokes.find((c) => c.name === "request-access")?.body).toEqual({
      email: "hopeful@example.com",
      message: "Coach Casey sent me",
    });
    expect(await screen.findByText(/your request is in/i)).toBeInTheDocument();
  });

  test("a valid invite link raises one Accept/Decline banner and drops the header Sign up", async () => {
    // The fake's invite_preview resolves to a My Team player invite.
    renderLanding("light", vi.fn(), "valid-token");

    expect(await screen.findByText(/invited to join My Team as a player/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept invite" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
    // Sign-in stays in the header; Sign up gives way to the banner's Accept.
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign up" })).not.toBeInTheDocument();
  });

  test("an invalid invite link falls back to the standard landing", async () => {
    vi.spyOn(supabaseFake, "rpc").mockResolvedValue({ data: [], error: null });

    renderLanding("light", vi.fn(), "spent-token");

    expect(await screen.findByText(/invite link is no longer valid/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept invite" })).not.toBeInTheDocument();
  });

  test("the theme toggle flips between light and dark", async () => {
    const onSetTheme = vi.fn();
    const user = userEvent.setup();

    renderLanding("dark", onSetTheme);
    await user.click(screen.getByRole("button", { name: "Switch to light theme" }));

    expect(onSetTheme).toHaveBeenCalledWith("light");
  });
});

// A logged-out visitor always sees the landing page (root, deep link, or invite link); a signed-in user
// never does. The hero's Try it opens the no-account sandbox. A signed-in invite link floats the shared
// surface over the app instead of a full-screen takeover.
describe("App wiring", () => {
  async function renderAppAt(path: string, loggedIn: boolean, hash = "") {
    if (!loggedIn) {
      vi.spyOn(supabaseFake.auth, "getSession").mockResolvedValue({
        data: { session: null },
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabaseFake.auth.getSession>>);
    }

    // Set the path first: replaceState rewrites the whole URL, so applying the hash afterward keeps it.
    window.history.replaceState(null, "", path);
    window.location.hash = hash;
    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );
  }

  test("a logged-out visitor at the root sees the landing page", async () => {
    await renderAppAt("/", false);

    expect(await screen.findByRole("heading", { level: 1, name: /Build the play/ })).toBeInTheDocument();
  });

  test("a logged-out visitor at a deep link also sees the landing page", async () => {
    await renderAppAt("/admin/teams", false);

    expect(await screen.findByRole("heading", { level: 1, name: /Build the play/ })).toBeInTheDocument();
  });

  test("a signed-in visitor at the root never sees the landing page", async () => {
    await renderAppAt("/", true);

    expect(await screen.findByRole("button", { name: /Sample Position/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Build the play/ })).not.toBeInTheDocument();
  });

  test("a logged-out invite link lands on the page, then accepts in the shared surface", async () => {
    const user = userEvent.setup();

    await renderAppAt("/", false, "#/invite/abc");

    // The landing page shows, with the invite banner; Accept opens the shared surface (account setup copy).
    expect(await screen.findByRole("heading", { level: 1, name: /Build the play/ })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Accept invite" }));

    const dialog = await screen.findByRole("dialog", { name: "Accept invite" });

    expect(within(dialog).getByText(/Set up your account to join My Team as a player/)).toBeInTheDocument();
  });

  test("Decline on the invite banner clears the token and returns to the standard landing", async () => {
    const user = userEvent.setup();

    await renderAppAt("/", false, "#/invite/abc");
    await user.click(await screen.findByRole("button", { name: "Decline" }));

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept invite" })).not.toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });

  test("a signed-in invite link floats the claim over the app, with Accept and Decline", async () => {
    await renderAppAt("/", true, "#/invite/abc");

    const dialog = await screen.findByRole("dialog", { name: "Accept invite" });

    // The signed-in one-click claim, in an overlay (not a full-screen invite screen).
    expect(within(dialog).getByText(/This link will join My Team as a player/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Join My Team" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Decline" })).toBeInTheDocument();
  });

  test("the hero's Try it opens the no-account sandbox", async () => {
    const user = userEvent.setup();

    await renderAppAt("/", false);
    const tryButtons = await screen.findAllByRole("button", { name: "Try it" });

    await user.click(tryButtons[0]);

    expect(await screen.findByRole("heading", { name: "Build a board" })).toBeInTheDocument();
  });

  test("the closing Try it opens the no-account sandbox", async () => {
    const user = userEvent.setup();

    await renderAppAt("/", false);
    const tryButtons = await screen.findAllByRole("button", { name: "Try it" });

    await user.click(tryButtons[tryButtons.length - 1]);

    expect(await screen.findByRole("heading", { name: "Build a board" })).toBeInTheDocument();
  });
});
