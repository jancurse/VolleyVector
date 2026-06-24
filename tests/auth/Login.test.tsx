import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { Login } from "../../src/auth/Login";
import { AuthProvider } from "../../src/auth/useAuth";

// Mock only the external Supabase client; the real Login and AuthProvider run against it.
vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

afterEach(() => vi.restoreAllMocks());

describe("Login", () => {
  test("reveals the reset-password request screen and returns to sign in", async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <Login />
      </AuthProvider>
    );

    await user.click(screen.getByRole("button", { name: "Forgot password?" }));

    expect(screen.getByRole("button", { name: "Send reset link" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to sign in" }));

    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });
});
