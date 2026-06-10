import { supabase } from "./client";

// Restoring a soft-deleted account runs server-side in the `restore-account` Edge Function (admin-only):
// it un-bans the auth user and clears the profile's deletion flag. The client only forwards the request.
export async function restoreAccount(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.functions.invoke("restore-account", { body: { userId } });

  if (!error) return { error: null };

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
