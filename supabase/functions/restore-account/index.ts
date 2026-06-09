// VolleyCoach — restore-account Edge Function.
// Brings back a soft-deleted account within its 3-month recovery window: clears the profile's deleted flag
// and un-bans the auth user, so they can log in again with their personal area intact. Admin-only — a
// soft-deleted user is banned and cannot authenticate to restore themselves. Un-banning needs the admin API,
// so this runs server-side with the privileged key, like delete-account. The user's authored team content
// was detached to the team at deletion time and is not (and need not be) re-claimed.
// Deploy from the Supabase dashboard (Edge Functions -> Deploy a new function -> Via Editor). Verify JWT off.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: who, error: whoError } = await caller.auth.getUser();

  if (whoError || !who.user) return json({ error: `Not authenticated: ${whoError?.message ?? "no user"}` }, 401);

  let body: { userId?: string };

  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.userId) return json({ error: "userId is required" }, 400);

  // Only an admin may restore an account.
  const { data: callerProfile } = await caller.from("profiles").select("is_admin").eq("id", who.user.id).maybeSingle();

  if (callerProfile?.is_admin !== true) return json({ error: "Not allowed to restore accounts." }, 403);

  const admin = createClient(url, serviceKey);

  const cleared = await admin.from("profiles").update({ deleted_at: null, deleted_by: null }).eq("id", body.userId);

  if (cleared.error) return json({ error: `Could not clear deletion flag: ${cleared.error.message}` }, 400);

  const { error: unbanError } = await admin.auth.admin.updateUserById(body.userId, { ban_duration: "none" });

  if (unbanError) return json({ error: `Could not re-enable account: ${unbanError.message}` }, 400);

  return json({ ok: true });
});
