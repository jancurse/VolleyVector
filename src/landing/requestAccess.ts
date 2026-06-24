import { supabase } from "../supabase/client";

// The client side of the landing page's "Request access" form. The app is invite-only, so this is how a
// logged-out visitor with no invite expresses interest. The public `request-access` Edge Function records
// the request (the source of truth) and sends a best-effort notification; the client only forwards it.

/** Submit interest in an account: an email and an optional message. Resolves to an error message or null. */
export async function requestAccess(email: string, message: string): Promise<{ error: string | null }> {
  const { error } = await supabase.functions.invoke("request-access", {
    body: { email: email.trim(), message: message.trim() },
  });

  if (!error) return { error: null };

  // A failed call carries the function's HTTP Response; surface the reason it returned rather than the
  // generic "Edge Function returned a non-2xx status code" (mirrors invites.ts).
  const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;

  if (context?.json) {
    try {
      const failure = await context.json();

      if (failure?.error) return { error: failure.error };
    } catch {
      // Body was not readable JSON; fall back to the generic message.
    }
  }

  return { error: error.message };
}
