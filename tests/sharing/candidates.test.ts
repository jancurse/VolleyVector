import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { fetchShareCandidates } from "../../src/sharing/candidates";
import { DELETED_ACCOUNT, OTHER_MEMBER, resetRecorded, TEST_TEAM_ID, TEST_USER } from "../helpers/supabaseFake";

// Mock only the external Supabase client; the real function runs against it.
vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

beforeEach(() => resetRecorded());
afterEach(() => vi.clearAllMocks());

test("excludes the sharer and soft-deleted teammates, returns a live teammate tagged with their team", async () => {
  const r = await fetchShareCandidates([{ teamId: TEST_TEAM_ID, teamName: "My Team", slug: "my-team" }], TEST_USER.id);

  expect(r.error).toBeNull();
  expect(r.candidates).toEqual([
    { userId: OTHER_MEMBER.id, displayName: "Player Pat", teamId: TEST_TEAM_ID, teamName: "My Team" },
  ]);
  expect(r.candidates.some((c) => c.userId === TEST_USER.id)).toBe(false);
  expect(r.candidates.some((c) => c.userId === DELETED_ACCOUNT.id)).toBe(false);
});
