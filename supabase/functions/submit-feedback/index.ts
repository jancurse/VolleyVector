// VolleyVector — submit-feedback Edge Function.
// A signed-in user reports a bug or requests a feature from the account menu. This function records the
// report via the secret key (the source of truth an admin works from), then sends a best-effort
// notification email through Resend. It mirrors request-access, with two differences: the caller is
// authenticated (authorized in code from their own login, not the secret key), and the report carries a
// type (bug or feature).
//
// The recorded row is what matters; the email is on top. A failed send must not fail the request or lose
// the row, so the send is wrapped and its failure swallowed. The response is a non-revealing success
// whenever the row was recorded.
//
// Deploy is automatic on merge (deploy-functions.yml). Keep "Verify JWT" off: the caller is authorized in
// code from their Authorization header, not by the platform's JWT gate.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// The notification recipient, overridable by the FEEDBACK_NOTIFY_EMAIL function secret. This is a
// volleyvector.app address whose mail Cloudflare Email Routing forwards on to a real inbox.
const DEFAULT_NOTIFY = "bug-reports@volleyvector.app";

// The service-role-equivalent secret key lives in SUPABASE_SECRET_KEYS, a JSON object of { name: key }
// injected into every function. Take the first sb_secret_... value. (Mirrors request-access.)
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

// The message and the reporter's details are user-supplied, so escape them before they go into the
// notification's HTML body. Otherwise a reporter could inject markup or a phishing link into the inbox an
// admin reads. The text part needs no escaping.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function notifyEmail(
  kind: "bug" | "feature",
  message: string,
  reporter: { name: string; email: string }
): { subject: string; html: string; text: string } {
  const label = kind === "bug" ? "Bug report" : "Feature request";
  const subject = `New ${label.toLowerCase()} for VolleyVector`;
  const who = `${reporter.name || "Someone"}${reporter.email ? ` (${reporter.email})` : ""}`;
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px;">
          <tr><td style="font-size:18px;font-weight:600;padding-bottom:12px;">VolleyVector</td></tr>
          <tr><td style="font-size:15px;line-height:1.5;padding-bottom:12px;">${escapeHtml(who)} sent a ${escapeHtml(label.toLowerCase())}.</td></tr>
          <tr><td style="font-size:15px;line-height:1.5;white-space:pre-wrap;"><strong>${escapeHtml(label)}:</strong><br />${escapeHtml(message)}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  const text = `${who} sent a ${label.toLowerCase()}.\n\n${label}:\n${message}`;

  return { subject, html, text };
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

  // The caller client acts as the signed-in user: we authorize from their own login, not the secret key.
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: who, error: whoError } = await caller.auth.getUser();

  if (whoError || !who.user) return json({ error: `Not authenticated: ${whoError?.message ?? "no user"}` }, 401);

  let body: { type?: string; message?: string };

  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const type = body.type === "bug" || body.type === "feature" ? body.type : null;
  // Cap the message so a caller cannot store an unbounded blob.
  const message = (body.message ?? "").trim().slice(0, 2000);

  if (!type) return json({ error: "Choose what kind of report this is." }, 400);
  if (!message) return json({ error: "Enter a message." }, 400);

  // Record the report first: it is the source of truth. A failed insert is a real failure the reporter
  // should hear about, since nothing was stored.
  const admin = createClient(url, serviceKey);
  const { error: insertError } = await admin.from("feedback").insert({ reporter: who.user.id, type, message });

  if (insertError) return json({ error: "Could not send your report. Please try again." }, 500);

  // The notification rides on top of the stored row: best-effort, so any failure is swallowed and the
  // report still succeeds. Look up the reporter's name and email so an admin can follow up.
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const notifyTo = Deno.env.get("FEEDBACK_NOTIFY_EMAIL") ?? DEFAULT_NOTIFY;

  if (resendKey) {
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name, email")
      .eq("id", who.user.id)
      .maybeSingle();
    const { subject, html, text } = notifyEmail(type, message, {
      name: profile?.display_name ?? "",
      email: profile?.email ?? "",
    });

    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "VolleyVector <noreply@volleyvector.app>", to: [notifyTo], subject, html, text }),
      });
    } catch {
      // Swallow: the report is recorded, and the notification is best-effort.
    }
  }

  return json({ ok: true });
});
