// VolleyVector — purge-expired Edge Function (scheduled cleanup).
// Permanently removes everything past its 3-month grace window. Two parts:
//   1. Accounts: a soft-deleted account's auth user can only be removed via the admin API (SQL cannot), so
//      for each profile whose deleted_at is older than the window we hard-delete the auth user. That cascades
//      the profile, memberships, and the user's access grants away; the reference-count trigger then
//      grace-archives any content left with no grants (content a team still holds survives). That freshly
//      archived content is hard-removed by a later run, once it too passes the window.
//   2. Boards, topics, and teams already past the window: handled by the SQL public.purge_expired(). A
//      deleted team's hard-delete cascades its grants, and the trigger archives whatever that orphans.
// There is no signed-in user here, so this is gated on the service key: the caller must present it as the
// bearer token. Schedule it (pg_cron http call, or a GitHub Action) with the secret key in Authorization.
// Deploy from the dashboard with Verify JWT off.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WINDOW = "3 months";

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

  if (!url) return json({ error: "Server not configured (missing SUPABASE_URL)" }, 500);
  if (!serviceKey) return json({ error: "Server not configured (no secret key found)" }, 500);

  // Gate: only a caller holding the service key may run the purge.
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");

  if (bearer !== serviceKey) return json({ error: "Not authorized" }, 401);

  const admin = createClient(url, serviceKey);

  // Cutoff is computed in SQL (now() - interval) for the account scan, to avoid clock drift.
  const { data: expired, error: scanError } = await admin
    .from("profiles")
    .select("id")
    .not("deleted_at", "is", null)
    .lt("deleted_at", new Date(Date.now() - 92 * 24 * 60 * 60 * 1000).toISOString());

  if (scanError) return json({ error: `Account scan failed: ${scanError.message}` }, 400);

  const accounts = (expired ?? []) as { id: string }[];
  const purgedAccounts: string[] = [];

  for (const { id } of accounts) {
    // Hard-deleting the auth user cascades the profile, memberships, and access grants; the reference-count
    // trigger then grace-archives any content left with no grants.
    const { error: delError } = await admin.auth.admin.deleteUser(id);

    if (!delError) purgedAccounts.push(id);
  }

  // Boards, topics, and teams past the window (the team delete cascades its remaining rows).
  const { error: rpcError } = await admin.rpc("purge_expired");

  if (rpcError) return json({ error: `Content purge failed: ${rpcError.message}`, purgedAccounts }, 400);

  return json({ ok: true, purgedAccounts, window: WINDOW });
});
