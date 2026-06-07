import type { TeamRole } from "../workspace/useWorkspace";
import { supabase } from "./client";

// Inviting a member runs server-side in the `invite` Edge Function, which holds the service-role key
// and authorizes the caller (a coach of the team, or an admin). The client only forwards the request.
export async function inviteMember(email: string, teamId: string, role: TeamRole): Promise<{ error: string | null }> {
  const { error } = await supabase.functions.invoke("invite", { body: { email, teamId, role } });

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
