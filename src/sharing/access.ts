import { supabase } from "../supabase/client";
import type { AccessRow } from "../supabase/rows";

// The pieces the board and note access managers share: the profile-naming types, the capability options, the
// principal label, and the access-list fetch. The two managers differ only in which access table the grants
// live in and how they key back to the content row, so the fetch is parameterized over both.

// No email: a non-admin client never receives another user's email, so a user grant is named by its
// display name alone (the profiles email column is not selectable by an ordinary client).
export type Profile = { id: string; display_name: string | null };

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

  return profile?.display_name || "Unknown user";
}

/** A content row's access list and the profiles needed to name its user grants. Only the granted users'
 *  profiles are fetched (bounded by the grant count), never the whole accounts table. */
export async function fetchAccess(
  table: "board_access" | "topic_access",
  idColumn: "board_id" | "topic_id",
  id: string
): Promise<AccessData> {
  const grantsR = await supabase.from(table).select("id, user_id, team_id, capability").eq(idColumn, id);

  if (grantsR.error) return { grants: [], profiles: new Map(), error: grantsR.error.message };

  const grants = (grantsR.data ?? []) as AccessRow[];
  const userIds = [...new Set(grants.map((g) => g.user_id).filter((v): v is string => v !== null))];
  const profilesR = userIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
    : { data: [], error: null };

  if (profilesR.error) return { grants, profiles: new Map(), error: profilesR.error.message };

  return {
    grants,
    profiles: new Map(((profilesR.data ?? []) as Profile[]).map((p) => [p.id, p])),
    error: null,
  };
}
