import { supabase } from "../supabase/client";
import type { Capability } from "../supabase/rows";

// Sharing with someone outside your teams. A grant link is a single-use token (a row in access_links,
// minted server-side) carrying a board/note and a capability; the first signed-in user to redeem it
// gets the grant on their own account. An exact-email grant resolves and grants server-side in one RPC
// that returns nothing either way, so it never reveals whether an account exists. Both are owner-only,
// enforced by RLS and the RPCs' own checks.

/** The shareable URL for a grant token: a hash route, so it resolves on a static host with no rewrite. */
export function grantLinkUrl(token: string): string {
  return `${window.location.origin}/#/grant/${token}`;
}

async function createLink(
  column: "board_id" | "topic_id",
  id: string,
  capability: Capability,
  createdBy: string
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("access_links")
    .insert({ [column]: id, capability, created_by: createdBy })
    .select("token")
    .single();

  if (error || !data) return { url: null, error: error?.message ?? "Could not create the link" };

  return { url: grantLinkUrl((data as { token: string }).token), error: null };
}

export function createBoardGrantLink(boardId: string, capability: Capability, createdBy: string) {
  return createLink("board_id", boardId, capability, createdBy);
}

export function createTopicGrantLink(topicId: string, capability: Capability, createdBy: string) {
  return createLink("topic_id", topicId, capability, createdBy);
}

export async function grantBoardByEmail(
  boardId: string,
  email: string,
  capability: Capability
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("grant_board_by_email", { board: boardId, addr: email, cap: capability });

  return { error: error?.message ?? null };
}

export async function grantTopicByEmail(
  topicId: string,
  email: string,
  capability: Capability
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("grant_topic_by_email", { root: topicId, addr: email, cap: capability });

  return { error: error?.message ?? null };
}

export type GrantLinkPreview = { kind: "board" | "note"; title: string; capability: Capability };

/** What a grant link opens, or null when it is spent, expired, or unknown. */
export async function accessLinkPreview(
  token: string
): Promise<{ preview: GrantLinkPreview | null; error: string | null }> {
  const { data, error } = await supabase.rpc("access_link_preview", { link_token: token });

  if (error) return { preview: null, error: error.message };

  const rows = (data ?? []) as { kind: "board" | "note"; title: string; capability: Capability }[];

  return { preview: rows[0] ?? null, error: null };
}

/** Redeem a grant link as the signed-in caller, returning the content they now hold. */
export async function redeemAccessLink(
  token: string
): Promise<{ boardId: string | null; topicId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("redeem_access_link", { link_token: token });

  if (error) return { boardId: null, topicId: null, error: error.message };

  const row = ((data ?? []) as { board_id: string | null; topic_id: string | null }[])[0];

  return { boardId: row?.board_id ?? null, topicId: row?.topic_id ?? null, error: null };
}
