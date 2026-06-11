import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import { AuthProvider } from "../../src/auth/useAuth";
import { useWorkspace } from "../../src/workspace/useWorkspace";

// A tailored Supabase mock: the user belongs to three teams (one active, one archived, one deleted), a
// fourth team exists without them, and a fifth is the showcase. Only the active membership reaches the
// team list; the fourth reaches an admin's other-teams list and nobody else's; the showcase reaches
// everyone, as its own field rather than either list.
const USER = { id: "u1", email: "coach@test" };

const TEAMS = [
  { id: "team-active", name: "Active", slug: "active", is_showcase: false, archived_at: null, deleted_at: null },
  {
    id: "team-archived",
    name: "Archived",
    slug: "archived",
    is_showcase: false,
    archived_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
  },
  {
    id: "team-deleted",
    name: "Deleted",
    slug: "deleted",
    is_showcase: false,
    archived_at: null,
    deleted_at: "2026-01-01T00:00:00Z",
  },
  { id: "team-other", name: "Other", slug: "other", is_showcase: false, archived_at: null, deleted_at: null },
  {
    id: "team-showcase",
    name: "Inspiration",
    slug: "inspiration",
    is_showcase: true,
    archived_at: null,
    deleted_at: null,
  },
];

const MEMBERSHIPS = TEAMS.slice(0, 3).map((t) => ({ team_id: t.id, role: "coach" }));

let isAdmin = false;

type Result = { data: unknown; error: null };
type Row = Record<string, unknown>;

function tableQuery(rows: Row[]) {
  const query = {
    select: () => query,
    eq: () => query,
    in: (column: string, values: unknown[]) => tableQuery(rows.filter((r) => values.includes(r[column]))),
    insert: () => Promise.resolve({ error: null }),
    delete: () => query,
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
      if (table === "profiles") return tableQuery([{ is_admin: isAdmin, display_name: "Jan" }]);
      if (table === "memberships") return tableQuery(MEMBERSHIPS);
      if (table === "teams") return tableQuery(TEAMS);

      return tableQuery([]);
    },
  },
}));

const wrapper = ({ children }: { children: ReactNode }) => createElement(AuthProvider, null, children);

describe("useWorkspace", () => {
  test.each([
    { admin: false, others: [] },
    { admin: true, others: ["team-other"] },
  ])("lists member teams, and non-member teams only for an admin (admin: $admin)", async ({ admin, others }) => {
    isAdmin = admin;

    const { result } = renderHook(() => useWorkspace(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.teams.map((t) => t.teamId)).toEqual(["team-active"]);
    expect(result.current.otherTeams.map((t) => t.teamId)).toEqual(others);
  });

  test.each([{ admin: false }, { admin: true }])(
    "exposes the showcase team to everyone, outside both team lists (admin: $admin)",
    async ({ admin }) => {
      isAdmin = admin;

      const { result } = renderHook(() => useWorkspace(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.showcase).toMatchObject({ teamId: "team-showcase", teamName: "Inspiration", role: null });
    }
  );

  test("a showcase membership stays out of the team list but carries its role", async () => {
    isAdmin = false;
    MEMBERSHIPS.push({ team_id: "team-showcase", role: "coach" });

    const { result } = renderHook(() => useWorkspace(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.teams.map((t) => t.teamId)).toEqual(["team-active"]);
    expect(result.current.showcase?.role).toBe("coach");

    MEMBERSHIPS.pop();
  });

  test("joinTeam and leaveTeam move a team between the member and other lists", async () => {
    isAdmin = true;

    const { result } = renderHook(() => useWorkspace(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.joinTeam("team-other", "player"));
    expect(result.current.teams.map((t) => t.teamId)).toEqual(["team-active", "team-other"]);
    expect(result.current.otherTeams).toEqual([]);

    await act(() => result.current.leaveTeam("team-other"));
    expect(result.current.teams.map((t) => t.teamId)).toEqual(["team-active"]);
    expect(result.current.otherTeams.map((t) => t.teamId)).toEqual(["team-other"]);
  });

  test("joinTeam and leaveTeam toggle a showcase membership on showcase.role, leaving both lists alone", async () => {
    isAdmin = true;

    const { result } = renderHook(() => useWorkspace(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.joinTeam("team-showcase", "coach"));
    expect(result.current.showcase?.role).toBe("coach");
    expect(result.current.teams.map((t) => t.teamId)).toEqual(["team-active"]);
    expect(result.current.otherTeams.map((t) => t.teamId)).toEqual(["team-other"]);

    await act(() => result.current.leaveTeam("team-showcase"));
    expect(result.current.showcase?.role).toBeNull();
    expect(result.current.teams.map((t) => t.teamId)).toEqual(["team-active"]);
  });
});
