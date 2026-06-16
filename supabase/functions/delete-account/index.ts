// VolleyCoach — delete-account Edge Function.
// Deleting an account is a soft-delete with a 3-month recovery window: it bans the auth user and stamps the
// profile deleted_at, nothing more. The caller is authorized from their own login (an admin may delete any
// non-admin account; any user may delete their own), then the privileged client bans and flags the target.
// Under the access-list model the user's content is reached purely through their grants, so banning them
// already removes them as an active principal: their personal content becomes inaccessible (only they held
// it, and they can no longer log in) while team-held content lives on through the team grant. The grants
// stay intact for the window, so restore is lossless. Reference-count grace-archive happens only at the hard
// purge, when deleting the auth user cascades their grants away (see purge-expired).
// Deploy from the Supabase dashboard (Edge Functions -> Deploy a new function -> Via Editor).
//
// Privileged calls use a new-format secret key (`sb_secret_...`) read from the auto-injected
// SUPABASE_SECRET_KEYS dictionary, not the legacy SUPABASE_SERVICE_ROLE_KEY.
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
  if (!authHeader) return json({ error: "Not authenticated (no Authorization header)" }, 401);

  // The caller client acts as the signed-in user; we authorize from their own profile, not the service key.
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: who, error: whoError } = await caller.auth.getUser();

  if (whoError || !who.user) return json({ error: `Not authenticated: ${whoError?.message ?? "no user"}` }, 401);

  let body: { userId?: string };

  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const target = body.userId ?? who.user.id;

  // Authorize: a user may delete themselves; otherwise the caller must be an admin.
  const { data: callerProfile } = await caller.from("profiles").select("is_admin").eq("id", who.user.id).maybeSingle();
  const isSelf = target === who.user.id;

  if (!isSelf && callerProfile?.is_admin !== true) return json({ error: "Not allowed to delete this account." }, 403);

  // Creating/deleting an auth user and reading another profile need the service role.
  const admin = createClient(url, serviceKey);

  // Admin accounts cannot be deleted by anyone, including themselves. To delete an admin, first revoke the
  // admin flag (the set_admin RPC), then delete.
  const { data: targetProfile, error: targetError } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", target)
    .maybeSingle();

  if (targetError) return json({ error: `Lookup failed: ${targetError.message}` }, 400);
  if (!targetProfile) return json({ error: "Account not found." }, 404);
  if (targetProfile.is_admin === true) return json({ error: "An admin account cannot be deleted. Revoke admin first." }, 403);

  // Account deletion is a soft-delete with a 3-month recovery window. We do NOT hard-delete the auth user
  // here, and we leave the user's grants intact so restore is lossless; the scheduled purge cascades the
  // grants away after the window. Two steps:
  //   1. Flag the profile deleted (the recovery window applies to the user's personal area + login).
  //   2. Ban the auth user so they cannot log in. Restore (restore-account) un-bans and clears the flag.
  const now = new Date().toISOString();

  const flagged = await admin
    .from("profiles")
    .update({ deleted_at: now, deleted_by: who.user.id })
    .eq("id", target);

  if (flagged.error) return json({ error: `Could not flag account: ${flagged.error.message}` }, 400);

  // Ban far into the future (~100 years). Restore sets ban_duration back to "none".
  const { error: banError } = await admin.auth.admin.updateUserById(target, { ban_duration: "876000h" });

  if (banError) return json({ error: `Could not disable account: ${banError.message}` }, 400);

  return json({ ok: true });
});
