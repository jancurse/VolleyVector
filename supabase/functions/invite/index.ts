// VolleyVector — invite Edge Function.
// Inviting a person into a team is the app's one privileged server-side action: creating an account
// and sending the email needs a secret server key, which must never reach the browser. The caller is
// authorized from their own login (an admin may invite into any team; a coach into a team they coach),
// then the account is created/found and linked to the team. Everything else stays under row-level
// security. Deploy from the Supabase dashboard (Edge Functions -> Deploy a new function -> Via Editor).
//
// Privileged calls use a new-format secret key (`sb_secret_...`) read from the auto-injected
// SUPABASE_SECRET_KEYS dictionary, not the legacy SUPABASE_SERVICE_ROLE_KEY, which is rejected once a
// project has migrated to the new publishable/secret key system.
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

  // The caller client acts as the signed-in user, so RLS lets it read the caller's own profile and
  // memberships. We authorize from those rather than from the service key.
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: who, error: whoError } = await caller.auth.getUser();

  if (whoError || !who.user) return json({ error: `Not authenticated: ${whoError?.message ?? "no user"}` }, 401);

  let body: { email?: string; teamId?: string; role?: string };

  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const teamId = body.teamId ?? "";
  const role = body.role === "player" ? "player" : "coach";

  if (!email || !teamId) return json({ error: "email and teamId are required" }, 400);

  // Authorize: an admin may invite anywhere; otherwise the caller must be a coach of this team.
  const { data: profile } = await caller.from("profiles").select("is_admin").eq("id", who.user.id).maybeSingle();

  let allowed = profile?.is_admin === true;

  if (!allowed) {
    const { data: membership } = await caller
      .from("memberships")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", who.user.id)
      .maybeSingle();

    allowed = membership?.role === "coach";
  }

  if (!allowed) return json({ error: "Not allowed to invite into this team." }, 403);

  // Creating/sending the invite needs the service role.
  const admin = createClient(url, serviceKey);

  const { data: existing, error: existingError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingError) return json({ error: `Service lookup failed: ${existingError.message}` }, 400);

  let invitedId = existing?.id as string | undefined;

  if (!invitedId) {
    const redirectTo = Deno.env.get("INVITE_REDIRECT_URL") ?? undefined;
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });

    if (inviteError || !invited.user) return json({ error: `Invite failed: ${inviteError?.message ?? "no user"}` }, 400);

    invitedId = invited.user.id;
  }

  const { error: linkError } = await admin
    .from("memberships")
    .upsert({ team_id: teamId, user_id: invitedId, role }, { onConflict: "team_id,user_id" });

  if (linkError) return json({ error: `Could not add to team: ${linkError.message}` }, 400);

  return json({ ok: true });
});
