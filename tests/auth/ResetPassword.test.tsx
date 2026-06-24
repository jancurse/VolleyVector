import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ResetPassword } from "../../src/auth/ResetPassword";
import { AuthProvider } from "../../src/auth/useAuth";
import { supabaseFake } from "../helpers/supabaseFake";

// Mock only the external Supabase client; the real ResetPassword (over the shared NewPasswordForm) and
// AuthProvider run against it.
vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

afterEach(() => vi.restoreAllMocks());

const EMAIL = "coach@volley.test";

function renderResetPassword(): { user: UserEvent; onDone: ReturnType<typeof vi.fn> } {
  const user = userEvent.setup();
  const onDone = vi.fn();

  render(
    <AuthProvider>
      <ResetPassword email={EMAIL} onDone={onDone} />
    </AuthProvider>
  );

  return { user, onDone };
}

describe("ResetPassword", () => {
  test("sets the new password and finishes", async () => {
    const update = vi.spyOn(supabaseFake.auth, "updateUser");
    const { user, onDone } = renderResetPassword();

    await user.type(screen.getByLabelText("Password"), "strongpass1");
    await user.type(screen.getByLabelText("Confirm password"), "strongpass1");
    await user.click(screen.getByRole("button", { name: "Save password" }));

    expect(update).toHaveBeenCalledWith({ password: "strongpass1" });
    expect(onDone).toHaveBeenCalled();
  });

  test.each([
    ["short", "short", /at least 8/i],
    ["strongpass1", "different1", /do not match/i],
  ])("rejects %s/%s without saving", async (password, confirm, message) => {
    const update = vi.spyOn(supabaseFake.auth, "updateUser");
    const { user, onDone } = renderResetPassword();

    await user.type(screen.getByLabelText("Password"), password);
    await user.type(screen.getByLabelText("Confirm password"), confirm);
    await user.click(screen.getByRole("button", { name: "Save password" }));

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});
