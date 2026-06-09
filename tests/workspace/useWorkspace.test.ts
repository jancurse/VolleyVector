import { renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import { AuthProvider } from "../../src/auth/useAuth";
import { useWorkspace } from "../../src/workspace/useWorkspace";

// A tailored Supabase mock: the user belongs to three teams, one active, one archived, one deleted. Only
// the active team should reach the workspace's team list (and so the space switcher).
const USER = { id: "u1", email: "coach@test" };

const TEAMS = [
  { id: "team-active", name: "Active", archived_at: null, deleted_at: null },
  { id: "team-archived", name: "Archived", archived_at: "2026-01-01T00:00:00Z", deleted_at: null },
  { id: "team-deleted", name: "Deleted", archived_at: null, deleted_at: "2026-01-01T00:00:00Z" },
];

const MEMBERSHIPS = TEAMS.map((t) => ({ team_id: t.id, role: "coach" }));

type Result = { data: unknown; error: null };

function tableQuery(rows: unknown[]) {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    single: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    then: (onfulfilled: (value: Result) => unknown) => Promise.resolve({ data: rows, error: null }).then(onfulfilled),
  };

  return query;
}

const session = { user: USER };

vi.mock("../../src/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: (table: string) => {
      if (table === "profiles") return tableQuery([{ is_admin: false }]);
      if (table === "memberships") return tableQuery(MEMBERSHIPS);
      if (table === "teams") return tableQuery(TEAMS);

      return tableQuery([]);
    },
  },
}));

const wrapper = ({ children }: { children: ReactNode }) => createElement(AuthProvider, null, children);

describe("useWorkspace", () => {
  test("excludes archived and deleted teams from the team list", async () => {
    const { result } = renderHook(() => useWorkspace(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.teams.map((t) => t.teamId)).toEqual(["team-active"]);
  });
});
