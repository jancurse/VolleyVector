import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ForgotPassword } from "../../src/auth/ForgotPassword";
import { recordedInvokes, resetRecorded } from "../helpers/supabaseFake";

// Mock only the external Supabase client; the real ForgotPassword and request helper run against it.
vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

afterEach(() => {
  resetRecorded();
  vi.restoreAllMocks();
});

async function requestReset(email: string): Promise<void> {
  const user = userEvent.setup();

  render(<ForgotPassword onBack={vi.fn()} />);
  await user.type(screen.getByLabelText("Email"), email);
  await user.click(screen.getByRole("button", { name: "Send reset link" }));
}

describe("ForgotPassword", () => {
  test("shows the same neutral confirmation regardless of account existence", async () => {
    await requestReset("  has-account@volley.test  ");

    expect(screen.getByText(/if an account exists for has-account@volley.test/i)).toBeInTheDocument();
    expect(recordedInvokes).toEqual([{ name: "request-password-reset", body: { email: "has-account@volley.test" } }]);

    resetRecorded();
    await requestReset("nobody@volley.test");

    // Identical confirmation copy and request shape: the UI never branches on whether an account matched.
    expect(screen.getByText(/if an account exists for nobody@volley.test/i)).toBeInTheDocument();
    expect(recordedInvokes).toEqual([{ name: "request-password-reset", body: { email: "nobody@volley.test" } }]);
  });

  test("returns to sign in", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(<ForgotPassword onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: "Back to sign in" }));

    expect(onBack).toHaveBeenCalled();
  });
});
