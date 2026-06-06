// VolleyCoach — invite Edge Function.
// Inviting a person into a team is the app's one privileged server-side action: creating an account
// and sending the email needs the service-role key, which must never reach the browser. The function
// authorizes the caller from their own JWT — an admin may invite into any team, a coach only into a
// team they coach — then creates (or finds) the account and links it to the team with the chosen role.
// Everything else stays under row-level security. Deploy with `supabase functions deploy invite` and
// set the service-role key as a function secret (see the README / Implementation Notes).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authHeader = req.headers.get("Authorization");

  if (!url || !serviceKey || !anonKey) return json({ error: "Server not configured" }, 500);
  if (!authHeader) return json({ error: "Not authenticated" }, 401);

  // Identify the caller from their bearer token (an anon client carrying the caller's JWT).
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: who, error: whoError } = await caller.auth.getUser();

  if (whoError || !who.user) return json({ error: "Not authenticated" }, 401);

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

  // The service-role client bypasses RLS for the privileged checks and writes below.
  const admin = createClient(url, serviceKey);

  // Authorize: an admin may invite anywhere; otherwise the caller must be a coach of this team.
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", who.user.id).single();
  let allowed = profile?.is_admin === true;

  if (!allowed) {
    const { data: membership } = await admin
      .from("memberships")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", who.user.id)
      .maybeSingle();

    allowed = membership?.role === "coach";
  }

  if (!allowed) return json({ error: "Not allowed to invite into this team" }, 403);

  // Reuse an existing account for this email, or invite a brand-new one (which emails them a set-password link).
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  let invitedId = existing?.id as string | undefined;

  if (!invitedId) {
    const redirectTo = Deno.env.get("INVITE_REDIRECT_URL") ?? undefined;
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });

    if (inviteError || !invited.user) return json({ error: inviteError?.message ?? "Could not send invite" }, 400);

    invitedId = invited.user.id;
  }

  const { error: linkError } = await admin
    .from("memberships")
    .upsert({ team_id: teamId, user_id: invitedId, role }, { onConflict: "team_id,user_id" });

  if (linkError) return json({ error: linkError.message }, 400);

  return json({ ok: true });
});
