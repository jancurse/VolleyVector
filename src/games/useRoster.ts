import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "../supabase/client";
import { rosterPlayerFromRow, rosterPlayerToRow } from "../supabase/rows";
import type { RosterPlayerRow } from "../supabase/rows";
import type { RosterPlayer } from "./types";

export type PlayerDraft = Omit<RosterPlayer, "id" | "archived">;

type Result = Promise<{ error: string | null }>;

const writeError = (error: { message: string; code?: string }): string =>
  error.code === "23505" ? "Another player already wears that number." : error.message;

// A team's roster, archived players included so a game still resolves everyone it names; the roster page
// and the squad picker show only the active ones. Writes are awaited and applied on success, and RLS lets
// only the team's coaches and admins make them. A duplicate jersey number trips the unique index.
export function useRoster(teamId: string | null): {
  players: RosterPlayer[];
  loading: boolean;
  error: string | null;
  addPlayer: (draft: PlayerDraft) => Result;
  addPlayers: (drafts: readonly PlayerDraft[]) => Result;
  updatePlayer: (id: string, draft: PlayerDraft) => Result;
  archivePlayer: (id: string) => Result;
} {
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!teamId) {
        setPlayers([]);
        setLoading(false);

        return;
      }

      setLoading(true);

      const { data, error } = await supabase.from("roster_players").select("*").eq("team_id", teamId);

      if (!active) return;

      setError(error?.message ?? null);
      setPlayers(((data ?? []) as RosterPlayerRow[]).map(rosterPlayerFromRow));
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [teamId]);

  const addPlayer = useCallback(
    async (draft: PlayerDraft): Result => {
      if (!teamId) return { error: "No team selected" };

      const id = crypto.randomUUID();
      const { error } = await supabase
        .from("roster_players")
        .insert({ id, team_id: teamId, ...rosterPlayerToRow(draft) });

      if (error) return { error: writeError(error) };

      setPlayers((prev) => [...prev, { ...draft, id, archived: false }]);

      return { error: null };
    },
    [teamId]
  );

  const addPlayers = useCallback(
    async (drafts: readonly PlayerDraft[]): Result => {
      if (!teamId) return { error: "No team selected" };

      const added = drafts.map((draft) => ({ ...draft, id: crypto.randomUUID(), archived: false }));
      const { error } = await supabase
        .from("roster_players")
        .insert(added.map((p) => ({ id: p.id, team_id: teamId, ...rosterPlayerToRow(p) })));

      if (error) return { error: writeError(error) };

      setPlayers((prev) => [...prev, ...added]);

      return { error: null };
    },
    [teamId]
  );

  const updatePlayer = useCallback(async (id: string, draft: PlayerDraft): Result => {
    const { error } = await supabase.from("roster_players").update(rosterPlayerToRow(draft)).eq("id", id);

    if (error) return { error: writeError(error) };

    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...draft } : p)));

    return { error: null };
  }, []);

  const archivePlayer = useCallback(async (id: string): Result => {
    const { error } = await supabase
      .from("roster_players")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return { error: error.message };

    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, archived: true } : p)));

    return { error: null };
  }, []);

  const sorted = useMemo(() => [...players].sort((a, b) => a.number - b.number), [players]);

  return {
    players: sorted,
    loading,
    error,
    addPlayer,
    addPlayers,
    updatePlayer,
    archivePlayer,
  };
}
