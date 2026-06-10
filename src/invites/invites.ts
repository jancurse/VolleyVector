import { supabase } from "../supabase/client";
import type { TeamRole } from "../workspace/useWorkspace";

// The client side of single-use invite links. Creating a link is a plain insert RLS allows a team's
// coaches; the server mints the token. Previewing a link reads a public function (no account). Redeeming
// runs in the `redeem-invite` Edge Function, which holds the secret key and creates the account if the
// recipient is new — the client only forwards the request.

/** The shareable link for a token: a hash route so it resolves on a static host with no server config. */
export function inviteUrl(token: string): string {
  return `${window.location.origin}/#/invite/${token}`;
}

/** Mint a single-use invite link for a team and role, returning its URL. */
export async function createInvite(
  teamId: string,
  role: TeamRole,
  createdBy: string
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("invites")
    .insert({ team_id: teamId, role, created_by: createdBy })
    .select("token")
    .single();

  if (error || !data) return { url: null, error: error?.message ?? "Could not create the invite link" };

  return { url: inviteUrl((data as { token: string }).token), error: null };
}

export type InvitePreview = { teamName: string; role: TeamRole };

/** What a link opens, or null when it is spent, expired, or unknown. */
export async function invitePreview(token: string): Promise<{ preview: InvitePreview | null; error: string | null }> {
  const { data, error } = await supabase.rpc("invite_preview", { invite_token: token });

  if (error) return { preview: null, error: error.message };

  const rows = (data ?? []) as { team_name: string; role: TeamRole }[];

  return { preview: rows[0] ? { teamName: rows[0].team_name, role: rows[0].role } : null, error: null };
}

async function callRedeem(body: Record<string, unknown>): Promise<{ error: string | null }> {
  const { error } = await supabase.functions.invoke("redeem-invite", { body });

  if (!error) return { error: null };

  // A failed call carries the function's HTTP Response; surface the reason it returned rather than the
  // generic "Edge Function returned a non-2xx status code".
  const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;

  if (context?.json) {
    try {
      const failure = await context.json();

      if (failure?.error) return { error: failure.error };
    } catch {
      // Body was not readable JSON; fall back to the generic message.
    }
  }

  return { error: error.message };
}

/** Redeem a link as a brand-new account, set up with the recipient's own email and password. */
export function redeemInvite(token: string, email: string, password: string): Promise<{ error: string | null }> {
  return callRedeem({ token, email, password });
}

/** Redeem a link for the already signed-in caller, joining them to the team. */
export function redeemInviteAsCurrentUser(token: string): Promise<{ error: string | null }> {
  return callRedeem({ token });
}
