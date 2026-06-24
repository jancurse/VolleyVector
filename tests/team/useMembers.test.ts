import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useMembers } from "../../src/team/useMembers";

// `useMembers` runs against a mocked Supabase client (its one external dependency). Each query — the
// memberships read and the follow-up profiles read — returns the success or error set per test, so a load
// failure is exercised independently of a genuinely empty roster.
type Result = { data: unknown; error: { message: string } | null };

let membershipResult: Result = { data: [], error: null };
let profileResult: Result = { data: [], error: null };

vi.mock("../../src/supabase/client", () => {
  const query = (settle: () => Result) => {
    const q: Record<string, unknown> = {};
    const chain = () => q;

    q.select = chain;
    q.eq = chain;
    q.in = chain;
    q.is = chain;
    q.then = (onfulfilled: (value: Result) => unknown) => Promise.resolve(settle()).then(onfulfilled);

    return q;
  };

  return {
    supabase: {
      from: (table: string) => query(() => (table === "memberships" ? membershipResult : profileResult)),
    },
  };
});

beforeEach(() => {
  membershipResult = { data: [], error: null };
  profileResult = { data: [], error: null };
});
afterEach(() => vi.clearAllMocks());

describe("useMembers", () => {
  test("a successful empty load reports no error", async () => {
    const { result } = renderHook(() => useMembers("t1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.members).toEqual([]);
  });

  test("a membership read failure surfaces the error instead of an empty roster", async () => {
    membershipResult = { data: null, error: { message: "Load failed" } };

    const { result } = renderHook(() => useMembers("t1"));

    await waitFor(() => expect(result.current.error).toBe("Load failed"));

    expect(result.current.loading).toBe(false);
    expect(result.current.members).toEqual([]);
  });

  test("a profiles read failure surfaces the error", async () => {
    membershipResult = { data: [{ user_id: "u1", role: "coach" }], error: null };
    profileResult = { data: null, error: { message: "Profiles down" } };

    const { result } = renderHook(() => useMembers("t1"));

    await waitFor(() => expect(result.current.error).toBe("Profiles down"));

    expect(result.current.members).toEqual([]);
  });
});
