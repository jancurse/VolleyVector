import { supabase } from "../supabase/client";
import type { AccessRow } from "../supabase/rows";

// The pieces the board and note access managers share: the profile-naming types, the capability options, the
// principal label, and the access-list fetch. The two managers differ only in which access table the grants
// live in and how they key back to the content row, so the fetch is parameterized over both.

export type Profile = { id: string; display_name: string | null; email: string | null };

export type AccessData = { grants: AccessRow[]; profiles: Map<string, Profile>; error: string | null };

export const CAPABILITY_OPTIONS = [
  { value: "viewer", label: "Viewer" },
  { value: "editor", label: "Editor" },
  { value: "owner", label: "Owner" },
];

export function principalName(
  grant: AccessRow,
  profiles: Map<string, Profile>,
  teamName: (id: string) => string
): string {
  if (grant.team_id) return `${teamName(grant.team_id)} (team)`;

  const profile = grant.user_id ? profiles.get(grant.user_id) : undefined;

  return profile?.display_name || profile?.email || "Unknown user";
}

/** A content row's access list and the profiles needed to name its user grants. */
export async function fetchAccess(
  table: "board_access" | "topic_access",
  idColumn: "board_id" | "topic_id",
  id: string
): Promise<AccessData> {
  const [grantsR, profilesR] = await Promise.all([
    supabase.from(table).select("id, user_id, team_id, capability").eq(idColumn, id),
    supabase.from("profiles").select("id, display_name, email"),
  ]);

  if (grantsR.error) return { grants: [], profiles: new Map(), error: grantsR.error.message };

  return {
    grants: (grantsR.data ?? []) as AccessRow[],
    profiles: new Map(((profilesR.data ?? []) as Profile[]).map((p) => [p.id, p])),
    error: null,
  };
}
