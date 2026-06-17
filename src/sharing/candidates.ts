import { supabase } from "../supabase/client";
import type { TeamRef } from "../workspace/useWorkspace";

// The users the sharer may add to an access list: their teammates across the teams they belong to. The
// add-a-person picker is scoped to these (people the sharer has a relationship with), never the global
// accounts table. Each candidate is tagged with the team it comes from so the picker can group them; a
// user on several of the sharer's teams appears under each.

export type ShareCandidate = { userId: string; displayName: string; teamId: string; teamName: string };

/** The sharer's teammates across the given teams. Excludes deleted accounts and the sharer themselves. */
export async function fetchShareCandidates(
  teams: readonly TeamRef[],
  selfId: string
): Promise<{ candidates: ShareCandidate[]; error: string | null }> {
  const teamIds = teams.map((t) => t.teamId);

  if (teamIds.length === 0) return { candidates: [], error: null };

  const membershipsR = await supabase.from("memberships").select("team_id, user_id").in("team_id", teamIds);

  if (membershipsR.error) return { candidates: [], error: membershipsR.error.message };

  const memberships = (membershipsR.data ?? []) as { team_id: string; user_id: string }[];
  const userIds = [...new Set(memberships.map((m) => m.user_id))];

  if (userIds.length === 0) return { candidates: [], error: null };

  // Exclude soft-deleted accounts: they keep their membership but must not be offered as a target.
  const profilesR = await supabase.from("profiles").select("id, display_name").in("id", userIds).is("deleted_at", null);

  if (profilesR.error) return { candidates: [], error: profilesR.error.message };

  const names = new Map(
    ((profilesR.data ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name])
  );
  const teamName = new Map(teams.map((t) => [t.teamId, t.teamName]));

  const candidates = memberships
    .filter((m) => m.user_id !== selfId && names.has(m.user_id))
    .map((m) => ({
      userId: m.user_id,
      displayName: names.get(m.user_id) || m.user_id,
      teamId: m.team_id,
      teamName: teamName.get(m.team_id) ?? "Team",
    }));

  return { candidates, error: null };
}
