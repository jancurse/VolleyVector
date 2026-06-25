import { supabase } from "../supabase/client";

// The client side of the in-app feedback form. A signed-in user reports a bug or requests a feature; the
// authenticated `submit-feedback` Edge Function records the report (the source of truth) and sends a
// best-effort notification. The client only forwards the type and message; the reporter is attached
// server-side from their login.

export type FeedbackType = "bug" | "feature";

/** Submit a bug report or feature request. Resolves to an error message or null. */
export async function sendFeedback(type: FeedbackType, message: string): Promise<{ error: string | null }> {
  const { error } = await supabase.functions.invoke("submit-feedback", {
    body: { type, message: message.trim() },
  });

  if (!error) return { error: null };

  // A failed call carries the function's HTTP Response; surface the reason it returned rather than the
  // generic "Edge Function returned a non-2xx status code" (mirrors requestAccess.ts).
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
