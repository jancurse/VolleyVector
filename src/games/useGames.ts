import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "../supabase/client";
import { gameFromRow, gameToContent } from "../supabase/rows";
import type { GameRow } from "../supabase/rows";
import type { Game } from "./types";

type Result = Promise<{ error: string | null }>;

// A team's games, newest fixture first (undated plans after the dated ones). Saving a game applies it to the
// list at once and writes the whole content row; RLS lets only the team's coaches and admins write.
export function useGames(teamId: string | null): {
  games: Game[];
  loading: boolean;
  error: string | null;
  createGame: (game: Omit<Game, "id" | "teamId">) => Promise<{ id: string | null; error: string | null }>;
  saveGame: (game: Game) => Result;
  deleteGame: (id: string) => Result;
} {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!teamId) {
        setGames([]);
        setLoading(false);

        return;
      }

      setLoading(true);

      const { data, error } = await supabase.from("games").select("*").eq("team_id", teamId);

      if (!active) return;

      setError(error?.message ?? null);
      setGames(((data ?? []) as GameRow[]).map(gameFromRow));
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [teamId]);

  const createGame = useCallback(
    async (draft: Omit<Game, "id" | "teamId">) => {
      if (!teamId) return { id: null, error: "No team selected" };

      const game: Game = { ...draft, id: crypto.randomUUID(), teamId };
      const { error } = await supabase.from("games").insert({ id: game.id, team_id: teamId, ...gameToContent(game) });

      if (error) return { id: null, error: error.message };

      setGames((prev) => [...prev, game]);

      return { id: game.id, error: null };
    },
    [teamId]
  );

  const saveGame = useCallback(async (game: Game): Result => {
    setGames((prev) => prev.map((g) => (g.id === game.id ? game : g)));

    const { error } = await supabase.from("games").update(gameToContent(game)).eq("id", game.id);

    return { error: error?.message ?? null };
  }, []);

  const deleteGame = useCallback(async (id: string): Result => {
    const { error } = await supabase.from("games").delete().eq("id", id);

    if (error) return { error: error.message };

    setGames((prev) => prev.filter((g) => g.id !== id));

    return { error: null };
  }, []);

  const sorted = useMemo(
    () => [...games].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.name.localeCompare(b.name)),
    [games]
  );

  return { games: sorted, loading, error, createGame, saveGame, deleteGame };
}
