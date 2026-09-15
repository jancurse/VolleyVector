// VolleyVector — redeem-invite Edge Function.
// Redeeming an invite link is a privileged server action: it claims the link, may create an account (global
// sign-up stays disabled, so accounts are only ever born here), grants invite quota, and adds a team
// membership. None of that can happen under the caller's own privileges, so it runs here under the secret
// key. The link is the authority: anyone holding a valid token may redeem it, either as the signed-in
// caller or as a brand-new account set up in the same request.
//
// A link carries up to three independent grants, in any combination, and the redeemer claims whatever
// applies to them — an existing account always winning over the account-creation grant:
//   - create an account (allows_new_account): the only quota-consuming grant, spending the inviter's slot
//     when a brand-new account is actually created;
//   - grant_quota: added to the redeemer's own quota, additively;
//   - a team membership (team_id + role).
// A signed-in caller never creates an account and never touches the inviter's quota; a brand-new visitor
// may create an account only when the link allows it, and is rejected otherwise.
//
// A link carries `max_uses` redemptions (1 for a single-use link), claimed one at a time by the atomic
// `claim_invite` increment, so two people racing the last use see exactly one winner. The claim happens
// before account creation so a loser never leaves an orphan account; `record_invite_account` runs only on
// full success, so a released claim never counts as a spent slot.
//
// Deploy from the Supabase dashboard (Edge Functions -> Deploy a new function -> Via Editor). Keep
// "Verify JWT" off: a new recipient has no JWT yet, and the function authorizes from the token instead.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// The service-role-equivalent secret key lives in SUPABASE_SECRET_KEYS, a JSON object of { name: key }
// injected into every function. Take the first sb_secret_... value.
function privilegedKey(): string | undefined {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (!raw) return undefined;

  try {
    return Object.values(JSON.parse(raw) as Record<string, unknown>).find(
      (v): v is string => typeof v === "string" && v.startsWith("sb_secret_")
    );
  } catch {
    return undefined;
  }
}

// The fields of a claimed invite row this function acts on; claim_invite returns the whole row.
type Invite = {
  team_id: string | null;
  role: string | null;
  allows_new_account: boolean;
  grant_quota: number;
  created_by: string;
  uses: number;
  max_uses: number;
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = privilegedKey();
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authHeader = req.headers.get("Authorization");

  if (!url || !anonKey) return json({ error: "Server not configured (missing SUPABASE_URL or anon key)" }, 500);
  if (!serviceKey) return json({ error: "Server not configured (no secret key found)" }, 500);

  let body: { token?: string; email?: string; password?: string };

  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const token = (body.token ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  if (!token) return json({ error: "Missing invite token" }, 400);

  const admin = createClient(url, serviceKey);

  // Claim one use atomically: only a token with a use left and time on the clock increments, and only one
  // racing request gets each use. Doing this first means a loser never creates an account.
  const { data: claimedRows, error: claimError } = await admin.rpc("claim_invite", { invite_token: token });
  const claimed = ((claimedRows ?? []) as Invite[])[0];

  if (claimError) return json({ error: `Could not redeem link: ${claimError.message}` }, 400);
  if (!claimed) return json({ error: "This invite link is no longer valid." }, 410);

  // Compensating rollback: undo every durable side effect this redemption made, then reopen the link so it
  // ends usable only when nothing persisted. Membership and the new account are torn down in reverse order;
  // the auth user is deleted only when we created it (an existing caller's account is never touched).
  let userId: string | undefined;
  let addedMembership = false;
  let createdAccount = false;

  const release = async () => {
    if (addedMembership && claimed.team_id && userId) {
      await admin.from("memberships").delete().eq("team_id", claimed.team_id).eq("user_id", userId);
    }

    if (createdAccount && userId) await admin.auth.admin.deleteUser(userId);
    await admin.rpc("release_invite", { invite_token: token });
  };

  // Resolve the user the link is for: the signed-in caller, or a new account from the supplied email and
  // password. An existing caller always wins over the account-creation grant.
  if (authHeader) {
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: who } = await caller.auth.getUser();

    userId = who.user?.id;
  }

  if (!userId) {
    if (!claimed.allows_new_account) {
      await release();

      return json({ error: "Sign in to accept this link — it does not create a new account." }, 401);
    }

    if (!email || !password) {
      await release();

      return json({ error: "An email and password are required to accept this invite." }, 400);
    }

    // Re-check the inviter's quota before creating the account (admins exempt): quota or other redemptions
    // may have changed since the link was minted. A link with a use left still reserves its whole count,
    // which already covers this redemption, so availability need only be non-negative; the claim that
    // exhausted the link dropped that reservation to the accounts it has created so far, so that one needs
    // a slot of its own.
    const { data: inviter } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("id", claimed.created_by)
      .maybeSingle();

    if (!inviter?.is_admin) {
      const needed = claimed.uses >= claimed.max_uses ? 1 : 0;
      const { data: available, error: quotaError } = await admin.rpc("invite_available", {
        target: claimed.created_by,
      });

      if (quotaError || (available ?? 0) < needed) {
        await release();

        return json({ error: "This invite link can no longer create an account." }, 409);
      }
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !created.user) {
      await release();
      const message = /already.*registered|exists/i.test(createError?.message ?? "")
        ? "An account with this email already exists. Sign in, then open the link again."
        : `Could not create the account: ${createError?.message ?? "unknown error"}`;

      return json({ error: message }, 400);
    }

    userId = created.user.id;
    createdAccount = true;
  }

  // Add the membership when the link carries a team. Leave an existing membership untouched so a stale
  // link can never silently re-role someone who is already on the team; the returned rows tell us whether
  // this call inserted one, so a later failure only ever rolls back a membership we created.
  if (claimed.team_id) {
    const { data: inserted, error: linkError } = await admin
      .from("memberships")
      .upsert(
        { team_id: claimed.team_id, user_id: userId, role: claimed.role },
        { onConflict: "team_id,user_id", ignoreDuplicates: true }
      )
      .select("user_id");

    if (linkError) {
      await release();

      return json({ error: `Could not add you to the team: ${linkError.message}` }, 400);
    }

    addedMembership = (inserted?.length ?? 0) > 0;
  }

  // Apply the quota grant additively (an atomic increment, so concurrent grants never lose an update).
  if (claimed.grant_quota > 0) {
    const { error: quotaError } = await admin.rpc("add_invite_quota", {
      target: userId,
      amount: claimed.grant_quota,
    });

    if (quotaError) {
      await release();

      return json({ error: `Could not grant invites: ${quotaError.message}` }, 400);
    }
  }

  // Finalize once every grant has landed: tally the account this redemption created, which is what a spent
  // link charges the inviter. Recorded last, so a released claim above never counts as spent.
  if (createdAccount) await admin.rpc("record_invite_account", { invite_token: token });

  return json({ ok: true });
});
