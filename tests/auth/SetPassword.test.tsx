import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { SetPassword } from "../../src/auth/SetPassword";
import { AuthProvider } from "../../src/auth/useAuth";
import { supabaseFake } from "../helpers/supabaseFake";

// Mock only the external Supabase client; the real SetPassword and AuthProvider run against it.
vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

afterEach(() => vi.restoreAllMocks());

const EMAIL = "coach@volley.test";

function renderSetPassword(): { user: UserEvent; onDone: ReturnType<typeof vi.fn> } {
  const user = userEvent.setup();
  const onDone = vi.fn();

  render(
    <AuthProvider>
      <SetPassword email={EMAIL} onDone={onDone} />
    </AuthProvider>
  );

  return { user, onDone };
}

describe("SetPassword", () => {
  test("sets the password and finishes", async () => {
    const update = vi.spyOn(supabaseFake.auth, "updateUser");
    const { user, onDone } = renderSetPassword();

    await user.type(screen.getByLabelText("Password"), "strongpass1");
    await user.type(screen.getByLabelText("Confirm password"), "strongpass1");
    await user.click(screen.getByRole("checkbox", { name: /Terms & Privacy/i }));
    await user.click(screen.getByRole("button", { name: "Save password" }));

    expect(update).toHaveBeenCalledWith({ password: "strongpass1" });
    expect(onDone).toHaveBeenCalled();
  });

  test("blocks saving until the terms are accepted", async () => {
    const update = vi.spyOn(supabaseFake.auth, "updateUser");
    const { user, onDone } = renderSetPassword();

    await user.type(screen.getByLabelText("Password"), "strongpass1");
    await user.type(screen.getByLabelText("Confirm password"), "strongpass1");
    await user.click(screen.getByRole("button", { name: "Save password" }));

    expect(update).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  test.each([
    ["short", "short", /at least 8/i],
    ["strongpass1", "different1", /do not match/i],
  ])("rejects %s/%s without saving", async (password, confirm, message) => {
    const update = vi.spyOn(supabaseFake.auth, "updateUser");
    const { user, onDone } = renderSetPassword();

    await user.type(screen.getByLabelText("Password"), password);
    await user.type(screen.getByLabelText("Confirm password"), confirm);
    await user.click(screen.getByRole("checkbox", { name: /Terms & Privacy/i }));
    await user.click(screen.getByRole("button", { name: "Save password" }));

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  test("offers a sign-out escape naming the account", async () => {
    const signOut = vi.spyOn(supabaseFake.auth, "signOut");
    const { user } = renderSetPassword();

    await user.click(screen.getByRole("button", { name: `Not ${EMAIL}? Sign out` }));

    expect(signOut).toHaveBeenCalled();
  });
});
