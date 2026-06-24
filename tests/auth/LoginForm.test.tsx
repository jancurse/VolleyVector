import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { LoginForm } from "../../src/auth/LoginForm";
import { AuthProvider } from "../../src/auth/useAuth";
import { recordedInvokes, resetRecorded } from "../helpers/supabaseFake";

// Mock only the external Supabase client; the real LoginForm, AuthProvider, and reset helper run against it.
vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

afterEach(() => {
  resetRecorded();
  vi.restoreAllMocks();
});

function renderForm(): void {
  render(
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}

describe("LoginForm", () => {
  test("reveals the reset-password request screen and returns to sign in", async () => {
    const user = userEvent.setup();

    renderForm();
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));

    expect(screen.getByRole("button", { name: "Send reset link" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to sign in" }));

    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  test("shows the same neutral confirmation regardless of account existence", async () => {
    const user = userEvent.setup();

    const requestReset = async (email: string) => {
      await user.click(screen.getByRole("button", { name: "Forgot password?" }));
      await user.type(screen.getByLabelText("Email"), email);
      await user.click(screen.getByRole("button", { name: "Send reset link" }));
    };

    renderForm();
    await requestReset("  has-account@volley.test  ");

    expect(screen.getByText(/if an account exists for has-account@volley.test/i)).toBeInTheDocument();
    expect(recordedInvokes).toEqual([{ name: "request-password-reset", body: { email: "has-account@volley.test" } }]);
  });
});
