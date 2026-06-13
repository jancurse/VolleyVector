import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { App } from "../../src/App";
import { AuthProvider } from "../../src/auth/useAuth";
import { resetFakeAuthz } from "../helpers/supabaseFake";
import { setViewportWidth } from "../helpers/viewport";

// Mock only the external Supabase client; the real stores, hooks, and components run against it.
vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

beforeEach(() => {
  localStorage.clear();
  resetFakeAuthz();
  window.location.hash = "";
  window.history.replaceState(null, "", "/");
});

async function renderApp(width: number): Promise<UserEvent> {
  setViewportWidth(width);

  const user = userEvent.setup();

  render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );

  await screen.findByRole("button", { name: /Sample Position/ });

  return user;
}

describe("drawer mode (below 960px)", () => {
  test("the top-bar toggle opens the navigation and picking a note closes it", async () => {
    const user = await renderApp(800);

    expect(screen.queryByRole("button", { name: "Notes" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    const nav = await screen.findByRole("dialog", { name: "Navigation" });

    await user.click(within(nav).getByRole("button", { name: "Defense" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Defense" })).toBeInTheDocument();
  });
});

describe("rail mode (960 to 1400px)", () => {
  test("spaces show as named badges and the Notes toggle expands the sidebar overlay", async () => {
    const user = await renderApp(1200);

    expect(screen.queryByRole("button", { name: "Open navigation" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Personal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My Team" })).toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: "Notes" });

    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    const nav = await screen.findByRole("dialog", { name: "Navigation" });

    expect(within(nav).getByRole("button", { name: "All Boards" })).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});
