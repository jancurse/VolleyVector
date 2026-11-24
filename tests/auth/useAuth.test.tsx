import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { AuthProvider, useAuth } from "../../src/auth/useAuth";

type FakeSession = { access_token: string; user: { id: string; email: string } };

const session = (token: string, id = "u1", email = "coach@example.com"): FakeSession => ({
  access_token: token,
  user: { id, email },
});

let authCallback: ((event: string, next: FakeSession | null) => void) | null = null;

vi.mock("../../src/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: session("first") }, error: null }),
      onAuthStateChange: (cb: (event: string, next: FakeSession | null) => void) => {
        authCallback = cb;

        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  },
}));

describe("useAuth", () => {
  test.each([
    { event: "TOKEN_REFRESHED", next: session("second"), keeps: true },
    { event: "SIGNED_IN", next: session("second"), keeps: true },
    { event: "USER_UPDATED", next: session("second"), keeps: false },
    { event: "SIGNED_IN", next: session("second", "u1", "new@example.com"), keeps: false },
    { event: "SIGNED_IN", next: session("second", "u2"), keeps: false },
  ])("$event keeps the same user object: $keeps", async ({ event, next, keeps }) => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));

    const before = result.current.user;

    act(() => authCallback?.(event, next));

    expect(result.current.session?.access_token).toBe("second");
    expect(result.current.user === before).toBe(keeps);
    expect(result.current.user).toEqual(next.user);
  });

  test("signing out clears the user", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.user).not.toBeNull());
    act(() => authCallback?.("SIGNED_OUT", null));

    expect(result.current.user).toBeNull();
  });
});
