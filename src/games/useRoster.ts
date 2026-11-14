import { useCallback, useEffect, useMemo, useState } from "react";

import { renameClashes, renamePlayers, sameName } from "../stats/gameSets";
import { updateSets } from "../stats/sets";
import { supabase } from "../supabase/client";
import { rosterPlayerFromRow, rosterPlayerToRow } from "../supabase/rows";
import type { RosterPlayerRow } from "../supabase/rows";
import type { RosterPlayer } from "./types";

export type PlayerDraft = Omit<RosterPlayer, "id" | "archived">;

type Result = Promise<{ error: string | null }>;

const writeError = (error: { message: string; code?: string }): string =>
  error.code === "23505" ? "Another player already wears that number." : error.message;

/** Recorded sets name players by name, so two players on a roster never share one. */
const nameTaken = (
  players: readonly RosterPlayer[],
  drafts: readonly PlayerDraft[],
  except?: string
): string | null => {
  for (const [i, d] of drafts.entries()) {
    const other = players.find((p) => p.id !== except && sameName(p.name, d.name));

    if (other || drafts.some((o, j) => j < i && sameName(o.name, d.name)))
      return `Another player${other?.archived ? ", removed from the roster," : ""} is already called ${d.name.trim()}.`;
  }

  return null;
};

/** The player removed from the roster whom a draft names: adding them again brings that player back. */
const removedPlayer = (players: readonly RosterPlayer[], draft: PlayerDraft): RosterPlayer | undefined =>
  players.find((p) => p.archived && sameName(p.name, draft.name));

/** Rename a player in every recorded set of the team's games that names them. */
async function renameInSets(teamId: string, from: string, to: string): Promise<string | null> {
  const { data, error } = await supabase.from("games").select("id").eq("team_id", teamId);

  if (error) return error.message;

  const renames = new Map([[from, to]]);
  const result = await updateSets(
    ((data ?? []) as { id: string }[]).map((g) => g.id),
    (set) =>
      renameClashes(set, renames).length
        ? { error: `Set ${set.meta.setNumber || "?"} of a game already has a player called ${to}.` }
        : renamePlayers(set, renames)
  );
  const notes = [
    result.error,
    result.skipped && "Sets with changes not saved yet in this browser keep the old name.",
  ].filter(Boolean);

  return notes.length
    ? `Renamed on the roster. ${notes.join(" ")} A set that still says ${from} lists them on its game’s page to match up.`
    : null;
}

// A team's roster, archived players included so a game still resolves everyone it names; the roster page
// and the squad picker show only the active ones. Writes are awaited and applied on success, and RLS lets
// only the team's coaches and admins make them. A duplicate jersey number trips the unique index. Renaming a
// player renames them in the team's recorded sets too.
export function useRoster(teamId: string | null): {
  players: RosterPlayer[];
  loading: boolean;
  error: string | null;
  addPlayers: (drafts: readonly PlayerDraft[]) => Promise<{ error: string | null; added: RosterPlayer[] }>;
  /** A rename that saved on the roster but not in every set comes back as a `warning`. */
  updatePlayer: (id: string, draft: PlayerDraft) => Promise<{ error: string | null; warning?: string }>;
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

  const addPlayers = useCallback(
    async (drafts: readonly PlayerDraft[]) => {
      const taken = nameTaken(
        players.filter((p) => !p.archived),
        drafts
      );

      if (!teamId || taken) return { error: taken ?? "No team selected", added: [] };

      const added = drafts.map((draft) => ({
        ...draft,
        id: removedPlayer(players, draft)?.id ?? crypto.randomUUID(),
        archived: false,
      }));
      const { error } = await supabase
        .from("roster_players")
        .upsert(added.map((p) => ({ id: p.id, team_id: teamId, archived_at: null, ...rosterPlayerToRow(p) })));

      if (error) return { error: writeError(error), added: [] };

      setPlayers((prev) => [...prev.filter((p) => !added.some((a) => a.id === p.id)), ...added]);

      return { error: null, added };
    },
    [teamId, players]
  );

  const updatePlayer = useCallback(
    async (id: string, draft: PlayerDraft) => {
      const before = players.find((p) => p.id === id);
      const taken = before && sameName(before.name, draft.name) ? null : nameTaken(players, [draft], id);

      if (taken) return { error: taken };

      const { error } = await supabase.from("roster_players").update(rosterPlayerToRow(draft)).eq("id", id);

      if (error) return { error: writeError(error) };

      setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...draft } : p)));

      const warning =
        teamId && before && before.name !== draft.name ? await renameInSets(teamId, before.name, draft.name) : null;

      return { error: null, warning: warning ?? undefined };
    },
    [teamId, players]
  );

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
    addPlayers,
    updatePlayer,
    archivePlayer,
  };
}
