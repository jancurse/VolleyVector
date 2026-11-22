import type { AppData, SetSummary } from "../stats/types";
import { supabase } from "../supabase/client";
import { gameFromRow, rosterPlayerFromRow, setSummaryFromRow } from "../supabase/rows";
import type { GameRow, RosterPlayerRow, SetSummaryRow } from "../supabase/rows";
import type { Game, RosterPlayer } from "./types";

// A game's share link: a coach turns it on and off, and anyone holding it reads the game page without an
// account. The visitor's data comes from one public function, which carries the game, its squad, and its sets'
// saved stats, and nothing else of the team.

/** A shared game as its link resolves it. */
export type SharedGame = {
  game: Game;
  teamName: string;
  /** The players in the game's squad, not the team's whole roster. */
  roster: RosterPlayer[];
  sets: SetSummary[];
  /** The saved stats of the sets that have them. */
  stats: { id: string; data: AppData }[];
};

type SharedSetRow = Omit<SetSummaryRow, "version" | "unpublished" | "updated_by_profile"> & {
  published: AppData | null;
};

type SharedGameRow = { game: GameRow; team_name: string | null; roster: RosterPlayerRow[]; sets: SharedSetRow[] };

/** Resolve a game from its share token through the public function (works without an account). */
export async function gameByToken(token: string): Promise<SharedGame | null> {
  const { data, error } = await supabase.rpc("game_by_token", { token });

  if (error || !data) return null;

  const row = data as SharedGameRow;

  return {
    game: gameFromRow(row.game),
    teamName: row.team_name ?? "",
    roster: row.roster.map(rosterPlayerFromRow),
    sets: row.sets.map((s) => setSummaryFromRow({ ...s, version: 0, unpublished: false, updated_by_profile: null })),
    stats: row.sets.flatMap((s) => (s.published ? { id: s.id, data: s.published } : [])),
  };
}

/** The shareable link for a token: a hash route, like a board's, so it resolves on a static host. */
export function gameShareUrl(token: string): string {
  return `${window.location.origin}/#/game/${token}`;
}

/** A game's share token, or null while it is not shared. */
export async function fetchGameShareToken(gameId: string): Promise<{ token: string | null; error: string | null }> {
  const { data, error } = await supabase.from("games").select("share_token").eq("id", gameId).maybeSingle();

  return { token: (data as { share_token: string | null } | null)?.share_token ?? null, error: error?.message ?? null };
}

/** Turn a game's sharing on or off; resolves to its token, null once off. */
export async function shareGame(
  gameId: string,
  shared: boolean
): Promise<{ token: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("share_game", { game: gameId, shared });

  return { token: error ? null : ((data as string | null) ?? null), error: error?.message ?? null };
}
