// VolleyVector — request-password-reset Edge Function.
// Self-service password recovery: a user who forgot their password asks for a reset link by email. The
// link is Supabase Auth's own recovery token, minted server-side with `generateLink` under the secret key,
// and delivered through Resend like every other VolleyVector email — no Supabase Auth SMTP configuration.
// The caller is unauthenticated by definition (they cannot sign in), so Verify JWT stays off and there is
// no Authorization header to honour.
//
// Oracle-safe by construction: the response is a uniform success whether or not an account matched and
// whether or not the email sent, so the request side never reveals which addresses have accounts. A missing
// account (generateLink errors with "user not found") and a send failure are logged server-side and return
// exactly the same body as a real send.
//
// Deploy from the Supabase dashboard (Edge Functions -> Deploy a new function -> Via Editor). Keep
// "Verify JWT" off: the caller has forgotten their password and has no session.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// The canonical production app the recovery link redirects back to (registered in Supabase Auth's redirect
// allow-list, as for login/share/invite). supabase-js consumes the recovery token from the URL on load.
const APP_URL = "https://volleyvector.app";

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

function resetEmail(link: string): { subject: string; html: string; text: string } {
  const subject = "Reset your VolleyVector password";
  const intro =
    "We received a request to reset the password for your VolleyVector account. Choose a new password with the button below. If you didn't request this, you can safely ignore this email.";
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px;">
          <tr><td style="font-size:18px;font-weight:600;padding-bottom:12px;">VolleyVector</td></tr>
          <tr><td style="font-size:15px;line-height:1.5;padding-bottom:24px;">${intro}</td></tr>
          <tr><td style="padding-bottom:24px;">
            <a href="${link}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:8px;">Reset password</a>
          </td></tr>
          <tr><td style="font-size:13px;line-height:1.5;color:#71717a;">This link can be used once and expires within the hour. If the button does not work, paste this link into your browser:<br /><a href="${link}" style="color:#2563eb;">${link}</a></td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  const text = `${intro}\n\nReset your password: ${link}\n\nThis link can be used once and expires within the hour.`;

  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = privilegedKey();
  const resendKey = Deno.env.get("RESEND_API_KEY");

  if (!url) return json({ error: "Server not configured (missing SUPABASE_URL)" }, 500);
  if (!serviceKey) return json({ error: "Server not configured (no secret key found)" }, 500);
  if (!resendKey) return json({ error: "Server not configured (no RESEND_API_KEY)" }, 500);

  let body: { email?: string };

  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const email = (body.email ?? "").trim().toLowerCase();

  if (!email) return json({ error: "email is required" }, 400);

  // From here every branch returns the same uniform success: a missing account and a send failure must be
  // indistinguishable from a real send, so the request side is no account-existence oracle.
  const done = () => json({ ok: true });
  const admin = createClient(url, serviceKey);

  // Mint Supabase Auth's own recovery link. It errors with "user not found" for an address with no account;
  // we log and fall through to the same success below rather than surface the difference.
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: APP_URL },
  });
  const link = data?.properties?.action_link;

  if (error || !link) {
    console.error(`request-password-reset: no link for a reset request (${error?.message ?? "no account"})`);

    return done();
  }

  const { subject, html, text } = resetEmail(link);

  try {
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "VolleyVector <noreply@volleyvector.app>", to: [email], subject, html, text }),
    });

    if (!sent.ok) console.error(`request-password-reset: Resend rejected the email (${sent.status})`);
  } catch (e) {
    console.error(`request-password-reset: could not reach the email service (${e instanceof Error ? e.message : e})`);
  }

  return done();
});
