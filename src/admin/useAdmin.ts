import { useCallback, useEffect, useState } from "react";

import { deleteAccount } from "../supabase/deleteAccount";
import { restoreAccount } from "../supabase/restoreAccount";
import { supabase } from "../supabase/client";

// The data and actions behind the admin panel. An admin reads every team, profile, and grace-archived
// board/note through RLS god-mode; the writes (team archive/restore, account delete, content restore) all
// hold under the existing admin policies, RPC, or Edge Function. Kept deliberately simple: every action
// reloads the whole snapshot rather than reconciling locally, and the panel only loads while it is open.

export type TeamState = "active" | "archived" | "deleted";

export type AdminTeam = { id: string; name: string; state: TeamState };
export type AdminProfile = {
  id: string;
  email: string;
  isAdmin: boolean;
  inviteQuota: number;
  deletedAt: string | null;
};
export type DeletedItem = { id: string; title: string };
export type AccessRequest = { id: string; email: string; message: string; createdAt: string; handledAt: string | null };

export type AdminData = {
  teams: AdminTeam[];
  profiles: AdminProfile[];
  deletedBoards: DeletedItem[];
  deletedNotes: DeletedItem[];
  accessRequests: AccessRequest[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  archiveTeam: (id: string) => Promise<{ error: string | null }>;
  unarchiveTeam: (id: string) => Promise<{ error: string | null }>;
  deleteTeam: (id: string) => Promise<{ error: string | null }>;
  restoreTeam: (id: string) => Promise<{ error: string | null }>;
  setInviteQuota: (userId: string, value: number) => Promise<{ error: string | null }>;
  removeAccount: (userId: string) => Promise<{ error: string | null }>;
  recoverAccount: (userId: string) => Promise<{ error: string | null }>;
  restoreBoard: (id: string) => Promise<{ error: string | null }>;
  restoreNote: (id: string) => Promise<{ error: string | null }>;
  handleRequest: (id: string) => Promise<{ error: string | null }>;
  dismissRequest: (id: string) => Promise<{ error: string | null }>;
};

type TeamRow = { id: string; name: string; archived_at: string | null; deleted_at: string | null };
type ProfileRow = {
  id: string;
  email: string | null;
  is_admin: boolean;
  invite_quota: number;
  deleted_at: string | null;
};
type ItemRow = { id: string; title: string };
type RequestRow = { id: string; email: string; message: string | null; created_at: string; handled_at: string | null };

function teamState(row: TeamRow): TeamState {
  if (row.deleted_at) return "deleted";
  if (row.archived_at) return "archived";

  return "active";
}

export function useAdmin(open: boolean): AdminData {
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [deletedBoards, setDeletedBoards] = useState<DeletedItem[]>([]);
  const [deletedNotes, setDeletedNotes] = useState<DeletedItem[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!open) return;

    let active = true;

    void (async () => {
      setLoading(true);
      setError(null);

      // The recovery list is every grace-archived board/note: a row archives only once its access list
      // empties (reference counting), so this holds individually-deleted content and content orphaned by a
      // team or account removal alike. Team deletion still flags only the team; its rows cascade on purge.
      // Email is admin-only, served by a security-definer RPC rather than a column any client could
      // select, so the admin panel reads the profile list through it.
      const [teamsR, profilesR, boardsR, notesR, requestsR] = await Promise.all([
        supabase.from("teams").select("id, name, archived_at, deleted_at"),
        supabase.rpc("admin_list_profiles"),
        supabase.from("boards").select("id, title, deleted_at").not("deleted_at", "is", null),
        supabase.from("topics").select("id, title, deleted_at").not("deleted_at", "is", null),
        supabase
          .from("access_requests")
          .select("id, email, message, created_at, handled_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
      ]);

      if (!active) return;

      const failed = teamsR.error ?? profilesR.error ?? boardsR.error ?? notesR.error ?? requestsR.error;

      if (failed) {
        setError(failed.message);
        setLoading(false);

        return;
      }

      setTeams(((teamsR.data ?? []) as TeamRow[]).map((t) => ({ id: t.id, name: t.name, state: teamState(t) })));
      setProfiles(
        ((profilesR.data ?? []) as ProfileRow[]).map((p) => ({
          id: p.id,
          email: p.email ?? "",
          isAdmin: p.is_admin,
          inviteQuota: p.invite_quota,
          deletedAt: p.deleted_at,
        }))
      );
      setDeletedBoards((boardsR.data ?? []) as ItemRow[]);
      setDeletedNotes((notesR.data ?? []) as ItemRow[]);
      setAccessRequests(
        ((requestsR.data ?? []) as RequestRow[]).map((r) => ({
          id: r.id,
          email: r.email,
          message: r.message ?? "",
          createdAt: r.created_at,
          handledAt: r.handled_at,
        }))
      );
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [open, tick]);

  const run = useCallback(
    async (op: PromiseLike<{ error: { message: string } | null }>): Promise<{ error: string | null }> => {
      const { error: writeError } = await op;

      if (writeError) return { error: writeError.message };

      reload();

      return { error: null };
    },
    [reload]
  );

  const archiveTeam = useCallback(
    (id: string) => run(supabase.from("teams").update({ archived_at: new Date().toISOString() }).eq("id", id)),
    [run]
  );

  const unarchiveTeam = useCallback(
    (id: string) => run(supabase.from("teams").update({ archived_at: null }).eq("id", id)),
    [run]
  );

  const deleteTeam = useCallback((id: string) => run(supabase.rpc("delete_team", { team: id })), [run]);

  const restoreTeam = useCallback(
    (id: string) => run(supabase.from("teams").update({ deleted_at: null }).eq("id", id)),
    [run]
  );

  const setInviteQuota = useCallback(
    (userId: string, value: number) => run(supabase.rpc("set_invite_quota", { target: userId, value })),
    [run]
  );

  const removeAccount = useCallback(
    async (userId: string): Promise<{ error: string | null }> => {
      const { error: callError } = await deleteAccount(userId);

      if (callError) return { error: callError };

      reload();

      return { error: null };
    },
    [reload]
  );

  const recoverAccount = useCallback(
    async (userId: string): Promise<{ error: string | null }> => {
      const { error: callError } = await restoreAccount(userId);

      if (callError) return { error: callError };

      reload();

      return { error: null };
    },
    [reload]
  );

  const restoreBoard = useCallback(
    (id: string) => run(supabase.from("boards").update({ deleted_at: null, deleted_by: null }).eq("id", id)),
    [run]
  );

  const restoreNote = useCallback(
    (id: string) => run(supabase.from("topics").update({ deleted_at: null, deleted_by: null }).eq("id", id)),
    [run]
  );

  const handleRequest = useCallback(
    (id: string) => run(supabase.from("access_requests").update({ handled_at: new Date().toISOString() }).eq("id", id)),
    [run]
  );

  // Dismiss is a soft-delete, so a dropped request drops out of the open list but stays in the table.
  const dismissRequest = useCallback(
    (id: string) => run(supabase.from("access_requests").update({ deleted_at: new Date().toISOString() }).eq("id", id)),
    [run]
  );

  return {
    teams,
    profiles,
    deletedBoards,
    deletedNotes,
    accessRequests,
    loading,
    error,
    reload,
    archiveTeam,
    unarchiveTeam,
    deleteTeam,
    restoreTeam,
    setInviteQuota,
    removeAccount,
    recoverAccount,
    restoreBoard,
    restoreNote,
    handleRequest,
    dismissRequest,
  };
}
