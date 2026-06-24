// VolleyVector — send-invite Edge Function.
// An email invite is an ordinary "New person" invite link, delivered by email instead of copied. It carries
// a team (the recipient joins it on redeem) or none (a team-less link onboards an account into its personal
// space only), mirroring a copied link.
// The only thing that must stay server-side is the Resend API key, so this function exists purely to mint
// the link and send the email under that key. Everything else runs as the caller under row-level security:
// the row is minted by the caller's own client, so the `invites_insert` policy and the `enforce_invite_quota`
// trigger apply exactly as for a copied link — never an unchecked service-role insert.
//
// The slot is reserved only when the email actually goes out: a failed send deletes the just-minted row,
// releasing the slot. The recipient redeems through the unchanged `#/invite/<token>` flow (invite_preview ->
// InviteAccept -> redeem-invite), which creates the account or joins an existing user and spends or releases
// the slot via `created_account`.
//
// Deploy from the Supabase dashboard (Edge Functions -> Deploy a new function -> Via Editor). Keep
// "Verify JWT" off: the caller is authorized in code from their own login.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// The canonical production app the invite link points to (the verified Resend sender's domain). The link is
// a hash route so it resolves on the static host with no server config, mirroring the client's inviteUrl().
const APP_URL = "https://volleyvector.app";

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

function inviteEmail(
  teamName: string | null,
  role: string | null,
  link: string
): { subject: string; html: string; text: string } {
  const subject = teamName ? `You're invited to ${teamName} on VolleyVector` : "You're invited to VolleyVector";
  const intro = teamName
    ? `You've been invited to join ${teamName} as a ${role} on VolleyVector, an app for volleyball tactics and drills.`
    : "You've been invited to join VolleyVector, an app for volleyball tactics and drills.";
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px;">
          <tr><td style="font-size:18px;font-weight:600;padding-bottom:12px;">VolleyVector</td></tr>
          <tr><td style="font-size:15px;line-height:1.5;padding-bottom:24px;">${intro}</td></tr>
          <tr><td style="padding-bottom:24px;">
            <a href="${link}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:8px;">Accept invite</a>
          </td></tr>
          <tr><td style="font-size:13px;line-height:1.5;color:#71717a;">This invite is single-use and expires in 7 days. If the button does not work, paste this link into your browser:<br /><a href="${link}" style="color:#2563eb;">${link}</a></td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  const text = `${intro}\n\nAccept the invite: ${link}\n\nThis invite is single-use and expires in 7 days.`;

  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const authHeader = req.headers.get("Authorization");

  if (!url || !anonKey) return json({ error: "Server not configured (missing SUPABASE_URL or anon key)" }, 500);
  if (!resendKey) return json({ error: "Server not configured (no RESEND_API_KEY)" }, 500);
  if (!authHeader) return json({ error: "Not authenticated (no Authorization header)" }, 401);

  // The caller client acts as the signed-in user, so every database action below runs under RLS as them.
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
  const teamId = (body.teamId ?? "").trim();
  const joinsTeam = teamId !== "";
  const role = joinsTeam ? (body.role === "coach" ? "coach" : "player") : null;

  if (!email) return json({ error: "email is required" }, 400);

  // Authorize for a clean message. A team invite needs an admin or a coach of that team; a team-less invite
  // needs only a signed-in account (the insert policy and quota trigger gate it under RLS at the mint below).
  // The mint re-enforces this, so this is the friendly 403, not the security boundary.
  if (joinsTeam) {
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
  }

  const teamName = joinsTeam
    ? ((await caller.from("teams").select("name").eq("id", teamId).maybeSingle()).data?.name ?? "your team")
    : null;

  // Mint the invite as the caller: identical to a copied "New person" link, so the insert policy and the
  // quota trigger gate it. A quota-exhausted mint raises here and never reaches the send.
  const { data: minted, error: mintError } = await caller
    .from("invites")
    .insert({
      created_by: who.user.id,
      allows_new_account: true,
      grant_quota: 0,
      team_id: joinsTeam ? teamId : null,
      role,
    })
    .select("token")
    .single();

  if (mintError || !minted) return json({ error: mintError?.message ?? "Could not create the invite" }, 400);

  const token = (minted as { token: string }).token;
  const { subject, html, text } = inviteEmail(teamName, role, `${APP_URL}/#/invite/${token}`);

  // The slot is reserved only on a real send: undo the mint on any failure so no row and no slot persist,
  // whether the request throws (network) or returns non-2xx (Resend rejected it).
  const rollback = () => caller.from("invites").delete().eq("token", token);
  const fail = (reason: string) => rollback().then(() => json({ error: `Could not send the invite email: ${reason}` }, 502));

  let sent: Response;

  try {
    sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "VolleyVector <noreply@volleyvector.app>", to: [email], subject, html, text }),
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "could not reach the email service");
  }

  if (!sent.ok) {
    let reason = sent.statusText;

    try {
      reason = ((await sent.json()) as { message?: string }).message ?? reason;
    } catch {
      // Body was not readable JSON; keep the status text.
    }

    return fail(reason);
  }

  return json({ ok: true });
});
