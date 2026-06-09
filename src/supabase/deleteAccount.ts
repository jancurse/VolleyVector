import { supabase } from "./client";

// Deleting an account runs server-side in the `delete-account` Edge Function, which holds the service-role
// key and authorizes the caller (themselves, or an admin deleting a non-admin). Pass no userId to delete
// your own account; an admin passes the target's id. The client only forwards the request.
export async function deleteAccount(userId?: string): Promise<{ error: string | null }> {
  const { error } = await supabase.functions.invoke("delete-account", { body: userId ? { userId } : {} });

  if (!error) return { error: null };

  // A failed call carries the function's HTTP Response; surface the reason it returned rather than the
  // generic "Edge Function returned a non-2xx status code".
  const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;

  if (context?.json) {
    try {
      const body = await context.json();

      if (body?.error) return { error: body.error };
    } catch {
      // Body was not readable JSON; fall back to the generic message.
    }
  }

  return { error: error.message };
}
