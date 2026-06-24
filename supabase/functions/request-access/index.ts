// VolleyVector — request-access Edge Function.
// VolleyVector is invite-only, so a logged-out visitor with no invite cannot sign up. The landing page's
// "Request access" form lets them express interest without an account. This function is public (no JWT):
// it validates the email, records the request via the secret key (the source of truth an admin works
// from), then sends a best-effort notification email through Resend.
//
// The recorded row is what matters; the email is on top. A failed send must not fail the request or lose
// the row, so the send is wrapped and its failure swallowed. The response is a non-revealing success
// whenever the row was recorded, regardless of the send outcome, so nothing about the recipient leaks.
//
// Deploy is automatic on merge (deploy-functions.yml). Keep "Verify JWT" off: the caller has no account.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// The notification recipient, overridable by the REQUEST_NOTIFY_EMAIL function secret. This is a
// volleyvector.app address whose mail Cloudflare Email Routing forwards on to a real inbox.
const DEFAULT_NOTIFY = "requests@volleyvector.app";

// The service-role-equivalent secret key lives in SUPABASE_SECRET_KEYS, a JSON object of { name: key }
// injected into every function. Take the first sb_secret_... value. (Mirrors redeem-invite.)
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

// A pragmatic email check: a single @ with non-empty, dot-free-optional sides and no spaces. Good enough
// to reject obvious junk; the real confirmation is whether an admin chooses to send an invite.
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function notifyEmail(email: string, message: string): { subject: string; html: string; text: string } {
  const subject = "New access request for VolleyVector";
  const note = message ? `\n\nMessage:\n${message}` : "";
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px;">
          <tr><td style="font-size:18px;font-weight:600;padding-bottom:12px;">VolleyVector</td></tr>
          <tr><td style="font-size:15px;line-height:1.5;padding-bottom:12px;">Someone asked for access to VolleyVector.</td></tr>
          <tr><td style="font-size:15px;line-height:1.5;padding-bottom:8px;"><strong>Email:</strong> ${email}</td></tr>
          ${message ? `<tr><td style="font-size:15px;line-height:1.5;white-space:pre-wrap;"><strong>Message:</strong><br />${message}</td></tr>` : ""}
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  const text = `Someone asked for access to VolleyVector.\n\nEmail: ${email}${note}`;

  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = privilegedKey();

  if (!url) return json({ error: "Server not configured (missing SUPABASE_URL)" }, 500);
  if (!serviceKey) return json({ error: "Server not configured (no secret key found)" }, 500);

  let body: { email?: string; message?: string };

  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const message = (body.message ?? "").trim();

  if (!looksLikeEmail(email)) return json({ error: "Enter a valid email address." }, 400);

  // Record the request first: it is the source of truth. A failed insert is a real failure the visitor
  // should hear about, since nothing was stored.
  const admin = createClient(url, serviceKey);
  const { error: insertError } = await admin
    .from("access_requests")
    .insert({ email, message: message || null });

  if (insertError) return json({ error: "Could not submit your request. Please try again." }, 500);

  // The notification rides on top of the stored row: best-effort, so any failure is swallowed and the
  // request still succeeds.
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const notifyTo = Deno.env.get("REQUEST_NOTIFY_EMAIL") ?? DEFAULT_NOTIFY;

  if (resendKey) {
    const { subject, html, text } = notifyEmail(email, message);

    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "VolleyVector <noreply@volleyvector.app>", to: [notifyTo], subject, html, text }),
      });
    } catch {
      // Swallow: the request is recorded, and the notification is best-effort.
    }
  }

  return json({ ok: true });
});
