import type { TeamRole } from "../workspace/useWorkspace";
import { supabase } from "./client";

// Inviting a member runs server-side in the `invite` Edge Function, which holds the service-role key
// and authorizes the caller (a coach of the team, or an admin). The client only forwards the request.
export async function inviteMember(email: string, teamId: string, role: TeamRole): Promise<{ error: string | null }> {
  const { error } = await supabase.functions.invoke("invite", { body: { email, teamId, role } });

  return { error: error ? error.message : null };
}
