import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../auth/useAuth";
import { supabase } from "../supabase/client";
import type { Space } from "./space";

// A user's workspace: the teams they belong to (and as what), the global-admin flag, and which space
// is active. The active space is either one of the user's teams or their private personal space, and
// content loads (boards, topics) are scoped to it.

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
  /** The user's display name, or null when they have not set one yet (the first-login prompt). */
  displayName: string | null;
  /** Save the user's display name; returns an error message, or null on success. */
  setDisplayName: (name: string) => Promise<{ error: string | null }>;
  teams: TeamMembership[];
  /** The space whose library is on screen: a team's, or the user's personal space. */
  activeSpace: Space;
  setActiveSpace: (space: Space) => void;
  /** The active team's id, or null when the personal space is active. */
  activeTeamId: string | null;
  /** The caller's role in the active team, or null when the personal space is active. */
  activeRole: TeamRole | null;
  /** Create a team (admins only) and switch to it; returns the new id, or null on failure. */
  createTeam: (name: string) => Promise<string | null>;
};

type MembershipRow = { team_id: string; role: TeamRole };
type TeamRow = { id: string; name: string; archived_at: string | null; deleted_at: string | null };

export function useWorkspace(): Workspace {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [displayName, setName] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamMembership[]>([]);
  const [activeSpace, setActiveSpace] = useState<Space>({ kind: "personal" });

  // Pick the landing space (the first team, or personal when in no team) once, on the first load, so a
  // later deliberate switch is never overridden.
  const defaulted = useRef(false);

  useEffect(() => {
    if (!user) return;

    let active = true;

    void (async () => {
      setLoading(true);
      setError(null);

      const profile = await supabase.from("profiles").select("is_admin, display_name").eq("id", user.id).single();
      const memberships = await supabase.from("memberships").select("team_id, role").eq("user_id", user.id);

      if (!active) return;

      if (profile.error || memberships.error) {
        setError(profile.error?.message ?? memberships.error?.message ?? "Failed to load workspace");
        setLoading(false);

        return;
      }

      const rows = (memberships.data ?? []) as MembershipRow[];
      const ids = rows.map((m) => m.team_id);
      const named = ids.length
        ? await supabase.from("teams").select("id, name, archived_at, deleted_at").in("id", ids)
        : null;

      if (!active) return;

      // An archived or deleted team is hidden from the space switcher, so neither can be the active space.
      const teamRows = (named?.data ?? []) as TeamRow[];
      const hidden = new Set(teamRows.filter((t) => t.archived_at || t.deleted_at).map((t) => t.id));
      const names = new Map(teamRows.map((t) => [t.id, t.name]));
      const list = rows
        .filter((m) => !hidden.has(m.team_id))
        .map((m) => ({ teamId: m.team_id, teamName: names.get(m.team_id) ?? "Team", role: m.role }));

      const data = profile.data as { is_admin: boolean; display_name: string | null };

      setIsAdmin(data.is_admin);
      setName(data.display_name);
      setTeams(list);

      if (!defaulted.current) {
        defaulted.current = true;
        setActiveSpace(list[0] ? { kind: "team", teamId: list[0].teamId } : { kind: "personal" });
      }

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
      setActiveSpace({ kind: "team", teamId });

      return teamId;
    },
    [user]
  );

  const setDisplayName = useCallback(
    async (name: string): Promise<{ error: string | null }> => {
      if (!user) return { error: "Not signed in" };

      const trimmed = name.trim();
      const { error } = await supabase.from("profiles").update({ display_name: trimmed }).eq("id", user.id);

      if (error) return { error: error.message };

      setName(trimmed);

      return { error: null };
    },
    [user]
  );

  const activeTeamId = activeSpace.kind === "team" ? activeSpace.teamId : null;
  const activeRole = teams.find((t) => t.teamId === activeTeamId)?.role ?? null;

  return {
    loading,
    error,
    isAdmin,
    displayName,
    setDisplayName,
    teams,
    activeSpace,
    setActiveSpace,
    activeTeamId,
    activeRole,
    createTeam,
  };
}
