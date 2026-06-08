import { useCallback, useEffect, useState } from "react";

import { supabase } from "../supabase/client";
import type { TeamRole } from "../workspace/useWorkspace";

export type Member = { userId: string; email: string; role: TeamRole };

type MembershipRow = { user_id: string; role: TeamRole };
type ProfileRow = { id: string; email: string | null };

// The members of one team, joined with their profiles for an email to show. Loads when given a team
// (null while a manager dialog is closed), and exposes a reload so a fresh invite shows immediately,
// plus setRole and remove to re-role or drop a member (RLS permits both for the team's coaches and
// admins).
export function useMembers(teamId: string | null): {
  members: Member[];
  loading: boolean;
  reload: () => void;
  setRole: (userId: string, role: TeamRole) => Promise<{ error: string | null }>;
  remove: (userId: string) => Promise<{ error: string | null }>;
} {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  const setRole = useCallback(
    async (userId: string, role: TeamRole): Promise<{ error: string | null }> => {
      if (!teamId) return { error: "No team selected" };

      const { error } = await supabase.from("memberships").update({ role }).eq("team_id", teamId).eq("user_id", userId);

      if (error) return { error: error.message };

      setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role } : m)));

      return { error: null };
    },
    [teamId]
  );

  const remove = useCallback(
    async (userId: string): Promise<{ error: string | null }> => {
      if (!teamId) return { error: "No team selected" };

      const { error } = await supabase.from("memberships").delete().eq("team_id", teamId).eq("user_id", userId);

      if (error) return { error: error.message };

      setMembers((prev) => prev.filter((m) => m.userId !== userId));

      return { error: null };
    },
    [teamId]
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!teamId) {
        setMembers([]);
        setLoading(false);

        return;
      }

      setLoading(true);

      const memberships = await supabase.from("memberships").select("user_id, role").eq("team_id", teamId);

      if (!active) return;

      const rows = (memberships.data ?? []) as MembershipRow[];
      const ids = rows.map((m) => m.user_id);
      const profiles = ids.length ? await supabase.from("profiles").select("id, email").in("id", ids) : null;

      if (!active) return;

      const emails = new Map(((profiles?.data ?? []) as ProfileRow[]).map((p) => [p.id, p.email ?? ""]));

      setMembers(rows.map((m) => ({ userId: m.user_id, email: emails.get(m.user_id) ?? "", role: m.role })));
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [teamId, tick]);

  return { members, loading, reload, setRole, remove };
}
