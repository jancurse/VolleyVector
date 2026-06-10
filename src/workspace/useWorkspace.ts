import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../auth/useAuth";
import { slugify } from "../routing/slug";
import { supabase } from "../supabase/client";
import type { Space } from "./space";

// A user's workspace: the teams they belong to (and as what), the global-admin flag, and which space
// is active. The active space is either one of the user's teams or their private personal space, and
// content loads (boards, topics) are scoped to it.

export type TeamRole = "coach" | "player";

/** A team as navigation needs it (id, name, URL handle), with or without a membership. */
export type TeamRef = {
  teamId: string;
  teamName: string;
  /** The team's URL handle: minted once at creation, stable across renames. */
  slug: string;
};

export type TeamMembership = TeamRef & { role: TeamRole };

export type Workspace = {
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  /** The user's display name, or null when they have not set one yet (the first-login prompt). */
  displayName: string | null;
  /** Save the user's display name; returns an error message, or null on success. */
  setDisplayName: (name: string) => Promise<{ error: string | null }>;
  teams: TeamMembership[];
  /** Teams the user is not a member of but may reach anyway (admins only; empty otherwise). */
  otherTeams: TeamRef[];
  /** The space whose library is on screen: a team's, or the user's personal space. */
  activeSpace: Space;
  setActiveSpace: (space: Space) => void;
  /** The active team's id, or null when the personal space is active. */
  activeTeamId: string | null;
  /** The caller's membership role in the active team, or null when not a member (admins still edit). */
  activeRole: TeamRole | null;
  /** Create a team (admins only) and switch to it; returns the new id, or null on failure. */
  createTeam: (name: string) => Promise<string | null>;
  /** Join one of the other teams with a chosen role (admins only); returns an error message or null. */
  joinTeam: (teamId: string, role: TeamRole) => Promise<{ error: string | null }>;
};

type MembershipRow = { team_id: string; role: TeamRole };
type TeamRow = { id: string; name: string; slug: string; archived_at: string | null; deleted_at: string | null };

export function useWorkspace(): Workspace {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [displayName, setName] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamMembership[]>([]);
  const [otherTeams, setOtherTeams] = useState<TeamRef[]>([]);
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

      const data = profile.data as { is_admin: boolean; display_name: string | null };
      const rows = (memberships.data ?? []) as MembershipRow[];
      const ids = rows.map((m) => m.team_id);
      // An admin reaches every team (RLS shows them all), so load the full list; anyone else only their own.
      const teamsQuery = supabase.from("teams").select("id, name, slug, archived_at, deleted_at");
      const named = data.is_admin ? await teamsQuery : ids.length ? await teamsQuery.in("id", ids) : null;

      if (!active) return;

      // An archived or deleted team is hidden from the space switcher, so neither can be the active space.
      const teamRows = (named?.data ?? []) as TeamRow[];
      const hidden = new Set(teamRows.filter((t) => t.archived_at || t.deleted_at).map((t) => t.id));
      const byId = new Map<string, TeamRow>(teamRows.map((t) => [t.id, t]));
      const list = rows
        .filter((m) => !hidden.has(m.team_id))
        .map((m) => ({
          teamId: m.team_id,
          teamName: byId.get(m.team_id)?.name ?? "Team",
          slug: byId.get(m.team_id)?.slug ?? m.team_id,
          role: m.role,
        }));
      const memberIds = new Set(ids);

      setIsAdmin(data.is_admin);
      setName(data.display_name);
      setTeams(list);
      setOtherTeams(
        teamRows
          .filter((t) => !hidden.has(t.id) && !memberIds.has(t.id))
          .map((t) => ({ teamId: t.id, teamName: t.name, slug: t.slug }))
      );

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

      let slug = slugify(name);
      let created = await supabase.from("teams").insert({ name, slug }).select("id").single();

      // Slugs are globally unique across teams; on a collision retry once with a random suffix.
      if (created.error?.code === "23505") {
        slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
        created = await supabase.from("teams").insert({ name, slug }).select("id").single();
      }

      if (created.error || !created.data) {
        setError(created.error?.message ?? "Could not create team");

        return null;
      }

      // The creator (an admin) is deliberately not added as a member: the team lands in their "other
      // teams", and they join explicitly with a chosen role if they want to be on the roster.
      const teamId = (created.data as { id: string }).id;

      setOtherTeams((prev) => [...prev, { teamId, teamName: name, slug }]);
      setActiveSpace({ kind: "team", teamId });

      return teamId;
    },
    [user]
  );

  const joinTeam = useCallback(
    async (teamId: string, role: TeamRole): Promise<{ error: string | null }> => {
      const team = otherTeams.find((t) => t.teamId === teamId);

      if (!user) return { error: "Not signed in" };
      if (!team) return { error: "Already a member of this team" };

      const { error } = await supabase.from("memberships").insert({ team_id: teamId, user_id: user.id, role });

      if (error) return { error: error.message };

      setTeams((prev) => [...prev, { ...team, role }]);
      setOtherTeams((prev) => prev.filter((t) => t.teamId !== teamId));

      return { error: null };
    },
    [user, otherTeams]
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
    otherTeams,
    activeSpace,
    setActiveSpace,
    activeTeamId,
    activeRole,
    createTeam,
    joinTeam,
  };
}
