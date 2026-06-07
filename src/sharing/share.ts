import type { Board } from "../boards/types";
import { supabase } from "../supabase/client";
import type { BoardRow } from "../supabase/rows";
import { boardFromRow, boardToInsert } from "../supabase/rows";

// Cross-space board moves that do not belong to one space's live list: deep-copying a board into the
// caller's personal space or a team library, resolving a board from its share token (for a link
// visitor), and building the link itself. The single-space edits (sharing, unsharing, an owner moving
// their own board) live on useBoards, which holds the optimistic list they mutate.

// A deep copy under a new id, authored by the copier and filed nowhere (its source topic lives in the
// other space). The server mints a fresh share token and clears the shared flag by default.
function deepCopy(board: Board, userId: string): Board {
  return { ...board, id: crypto.randomUUID(), owner: userId, topicId: null, shared: false, teamId: null };
}

/** Copy a readable board into the caller's personal space (My Boards). */
export async function copyBoardToPersonal(board: Board, userId: string): Promise<{ error: string | null }> {
  const copy = deepCopy(board, userId);
  const { error } = await supabase.from("boards").insert(boardToInsert(copy, userId, "personal", null));

  return { error: error?.message ?? null };
}

/** Promote a readable board into a team's library by copying it there (a coach of that team). */
export async function copyBoardToTeam(board: Board, userId: string, teamId: string): Promise<{ error: string | null }> {
  const copy = deepCopy(board, userId);
  const { error } = await supabase.from("boards").insert(boardToInsert(copy, userId, "team", teamId));

  return { error: error?.message ?? null };
}

/** Resolve a board from its share token through the public function (works without an account). */
export async function boardByToken(token: string): Promise<{ board: Board | null; error: string | null }> {
  const { data, error } = await supabase.rpc("board_by_token", { token });

  if (error) return { board: null, error: error.message };

  const rows = (data ?? []) as BoardRow[];

  return { board: rows[0] ? boardFromRow(rows[0]) : null, error: null };
}

/** The shareable link for a token: a hash route so it resolves on a static host with no server config. */
export function shareUrl(token: string): string {
  return `${window.location.origin}/#/share/${token}`;
}

/** Fetch a board's share token and build its link, or null if it cannot be read. */
export async function fetchShareUrl(boardId: string): Promise<string | null> {
  const { data, error } = await supabase.from("boards").select("share_token").eq("id", boardId).single();

  if (error || !data) return null;

  return shareUrl((data as { share_token: string }).share_token);
}
