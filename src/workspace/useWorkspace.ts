import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../auth/useAuth";
import { supabase } from "../supabase/client";

// A user's workspace: the teams they belong to (and as what), the global-admin flag, and which space
// is active. Content loads are scoped to the active team. The personal space and its navigation arrive
// in Stage 2; for now the active space is always one of the user's teams.

export type TeamRole = "coach" | "player";

export type TeamMembership = {
  teamId: string;
  teamName: string;
  role: TeamRole;
};

export type Workspace = {
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  teams: TeamMembership[];
  activeTeamId: string | null;
  /** The caller's role in the active team, or null when none is active. */
  activeRole: TeamRole | null;
  setActiveTeamId: (teamId: string) => void;
  /** Create a team (admins only) and switch to it; returns the new id, or null on failure. */
  createTeam: (name: string) => Promise<string | null>;
};

type MembershipRow = { team_id: string; role: TeamRole };
type TeamRow = { id: string; name: string };

export function useWorkspace(): Workspace {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [teams, setTeams] = useState<TeamMembership[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    let active = true;

    void (async () => {
      setLoading(true);
      setError(null);

      const profile = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
      const memberships = await supabase.from("memberships").select("team_id, role").eq("user_id", user.id);

      if (!active) return;

      if (profile.error || memberships.error) {
        setError(profile.error?.message ?? memberships.error?.message ?? "Failed to load workspace");
        setLoading(false);

        return;
      }

      const rows = (memberships.data ?? []) as MembershipRow[];
      const ids = rows.map((m) => m.team_id);
      const named = ids.length ? await supabase.from("teams").select("id, name").in("id", ids) : null;

      if (!active) return;

      const names = new Map(((named?.data ?? []) as TeamRow[]).map((t) => [t.id, t.name]));
      const list = rows.map((m) => ({ teamId: m.team_id, teamName: names.get(m.team_id) ?? "Team", role: m.role }));

      setIsAdmin((profile.data as { is_admin: boolean }).is_admin);
      setTeams(list);
      setActiveTeamId((prev) => prev ?? list[0]?.teamId ?? null);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [user]);

  const createTeam = useCallback(
    async (name: string): Promise<string | null> => {
      if (!user) return null;

      const created = await supabase.from("teams").insert({ name }).select("id").single();

      if (created.error || !created.data) {
        setError(created.error?.message ?? "Could not create team");

        return null;
      }

      const teamId = (created.data as { id: string }).id;
      const linked = await supabase.from("memberships").insert({ team_id: teamId, user_id: user.id, role: "coach" });

      if (linked.error) {
        setError(linked.error.message);

        return null;
      }

      setTeams((prev) => [...prev, { teamId, teamName: name, role: "coach" }]);
      setActiveTeamId(teamId);

      return teamId;
    },
    [user]
  );

  const activeRole = teams.find((t) => t.teamId === activeTeamId)?.role ?? null;

  return { loading, error, isAdmin, teams, activeTeamId, activeRole, setActiveTeamId, createTeam };
}
