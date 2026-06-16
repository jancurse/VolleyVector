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
export type AdminProfile = { id: string; email: string; isAdmin: boolean; deletedAt: string | null };
export type DeletedItem = { id: string; title: string };

export type AdminData = {
  teams: AdminTeam[];
  profiles: AdminProfile[];
  deletedBoards: DeletedItem[];
  deletedNotes: DeletedItem[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  archiveTeam: (id: string) => Promise<{ error: string | null }>;
  unarchiveTeam: (id: string) => Promise<{ error: string | null }>;
  deleteTeam: (id: string) => Promise<{ error: string | null }>;
  restoreTeam: (id: string) => Promise<{ error: string | null }>;
  removeAccount: (userId: string) => Promise<{ error: string | null }>;
  recoverAccount: (userId: string) => Promise<{ error: string | null }>;
  restoreBoard: (id: string) => Promise<{ error: string | null }>;
  restoreNote: (id: string) => Promise<{ error: string | null }>;
};

type TeamRow = { id: string; name: string; archived_at: string | null; deleted_at: string | null };
type ProfileRow = { id: string; email: string | null; is_admin: boolean; deleted_at: string | null };
type ItemRow = { id: string; title: string };

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
      const [teamsR, profilesR, boardsR, notesR] = await Promise.all([
        supabase.from("teams").select("id, name, archived_at, deleted_at"),
        supabase.from("profiles").select("id, email, is_admin, deleted_at"),
        supabase.from("boards").select("id, title, deleted_at").not("deleted_at", "is", null),
        supabase.from("topics").select("id, title, deleted_at").not("deleted_at", "is", null),
      ]);

      if (!active) return;

      const failed = teamsR.error ?? profilesR.error ?? boardsR.error ?? notesR.error;

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
          deletedAt: p.deleted_at,
        }))
      );
      setDeletedBoards((boardsR.data ?? []) as ItemRow[]);
      setDeletedNotes((notesR.data ?? []) as ItemRow[]);
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

  return {
    teams,
    profiles,
    deletedBoards,
    deletedNotes,
    loading,
    error,
    reload,
    archiveTeam,
    unarchiveTeam,
    deleteTeam,
    restoreTeam,
    removeAccount,
    recoverAccount,
    restoreBoard,
    restoreNote,
  };
}
