import type { Board } from "../boards/types";
import { supabase } from "../supabase/client";
import type { BoardRow } from "../supabase/rows";
import { boardFromRow, boardToInsert } from "../supabase/rows";
import type { Space } from "../workspace/space";

// Cross-space board actions that do not belong to one space's live list: deep-copying a board into another
// space the caller may write (a deliberate fork), resolving a board from its share token (for a link
// visitor) or by id (for a deep link), and building the link itself. The single-space edits (the access
// list, committing) live on useBoards, which holds the optimistic list they mutate.

/** A grant on a board's access list, as the deep-link self-heal needs it (principal columns only). */
export type BoardGrant = { user_id: string | null; team_id: string | null };

// A deep copy under a new id, authored by the copier and starting with no history.
function deepCopy(board: Board, userId: string): Board {
  return { ...board, id: crypto.randomUUID(), createdBy: userId, capability: "owner", currentRevisionId: null };
}

/** Deep-copy a readable board into a space the caller may write: their personal space, or the library of a
 *  team they coach (RLS enforces both). Inserts the new board and its owner grant for the target space. A
 *  copy into the *active* space belongs on useBoards instead, so the open list shows it. */
export async function copyBoardToSpace(board: Board, userId: string, space: Space): Promise<{ error: string | null }> {
  const copy = deepCopy(board, userId);
  const inserted = await supabase.from("boards").insert(boardToInsert(copy, userId));

  if (inserted.error) return { error: inserted.error.message };

  const grant = {
    board_id: copy.id,
    user_id: space.kind === "team" ? null : userId,
    team_id: space.kind === "team" ? space.teamId : null,
    capability: "owner",
  };
  const { error } = await supabase.from("board_access").insert(grant);

  return { error: error?.message ?? null };
}

/** Resolve a board from its share token through the public function (works without an account). */
export async function boardByToken(token: string): Promise<{ board: Board | null; error: string | null }> {
  const { data, error } = await supabase.rpc("board_by_token", { token });

  if (error) return { board: null, error: error.message };

  const rows = (data ?? []) as BoardRow[];

  return { board: rows[0] ? boardFromRow(rows[0], "viewer") : null, error: null };
}

/** Resolve a board by its id for a path deep link, returning its grants so a stale link can self-heal to a
 *  space the board lives in. RLS hides unreadable rows, so a null board means "not found or no access" — the
 *  two are indistinguishable on read and both surface a single not-found state. */
export async function fetchBoardById(boardId: string): Promise<{ board: Board | null; grants: BoardGrant[] }> {
  const { data, error } = await supabase
    .from("boards")
    .select("*, board_access(user_id, team_id)")
    .eq("id", boardId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return { board: null, grants: [] };

  const row = data as BoardRow & { board_access: BoardGrant[] };

  return { board: boardFromRow(row, "viewer"), grants: row.board_access };
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
