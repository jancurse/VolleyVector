import { supabase } from "../supabase/client";
import type { TeamRole } from "../workspace/useWorkspace";

// The client side of single-use invite links. Creating a link is a plain insert RLS allows (a team's
// coaches for a team link, anyone for a team-less one); the server mints the token and enforces the quota.
// Previewing a link reads a public function (no account). Redeeming runs in the `redeem-invite` Edge
// Function, which holds the secret key and creates the account if the recipient is new — the client only
// forwards the request.

/** The shareable link for a token: a hash route so it resolves on a static host with no server config. */
export function inviteUrl(token: string): string {
  return `${window.location.origin}/#/invite/${token}`;
}

/** The grants a new link carries, in any combination: create an account, grant quota, join a team. */
export type NewInvite = {
  createdBy: string;
  /** May this link bring a brand-new account into existence (the only quota-consuming grant). */
  allowsNewAccount: boolean;
  /** Quota added to the redeemer's own account (additive); admins only, enforced server-side. */
  grantQuota: number;
  /** The team to join, with its role; both null for a team-less link. */
  teamId: string | null;
  role: TeamRole | null;
};

/** Mint a single-use invite link, returning its URL. The server rejects a mint over quota. */
export async function createInvite(invite: NewInvite): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("invites")
    .insert({
      created_by: invite.createdBy,
      allows_new_account: invite.allowsNewAccount,
      grant_quota: invite.grantQuota,
      team_id: invite.teamId,
      role: invite.role,
    })
    .select("token")
    .single();

  if (error || !data) return { url: null, error: error?.message ?? "Could not create the invite link" };

  return { url: inviteUrl((data as { token: string }).token), error: null };
}

/** Every right a still-valid link carries, for the accept screen. team/role are null on a team-less link. */
export type InvitePreview = {
  allowsNewAccount: boolean;
  grantQuota: number;
  teamName: string | null;
  role: TeamRole | null;
};

/** What a link opens, or null when it is spent, expired, or unknown. */
export async function invitePreview(token: string): Promise<{ preview: InvitePreview | null; error: string | null }> {
  const { data, error } = await supabase.rpc("invite_preview", { invite_token: token });

  if (error) return { preview: null, error: error.message };

  const row = (
    (data ?? []) as {
      allows_new_account: boolean;
      grant_quota: number;
      team_name: string | null;
      role: TeamRole | null;
    }[]
  )[0];

  if (!row) return { preview: null, error: null };

  return {
    preview: {
      allowsNewAccount: row.allows_new_account,
      grantQuota: row.grant_quota,
      teamName: row.team_name,
      role: row.role,
    },
    error: null,
  };
}

/** The caller's remaining invites, or null when unlimited (an admin). */
export async function inviteAvailability(): Promise<{ available: number | null; error: string | null }> {
  const { data, error } = await supabase.rpc("invite_availability");

  if (error) return { available: null, error: error.message };

  return { available: (data as number | null) ?? null, error: null };
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

/** Redeem a link for the already signed-in caller, claiming every grant that applies to them. */
export function redeemInviteAsCurrentUser(token: string): Promise<{ error: string | null }> {
  return callRedeem({ token });
}
