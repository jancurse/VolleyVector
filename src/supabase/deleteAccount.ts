import { invokeFunction } from "./invokeFunction";

// Deleting an account runs server-side in the `delete-account` Edge Function, which holds the service-role
// key and authorizes the caller (themselves, or an admin deleting a non-admin). Pass no userId to delete
// your own account; an admin passes the target's id. The client only forwards the request.
export function deleteAccount(userId?: string): Promise<{ error: string | null }> {
  return invokeFunction("delete-account", userId ? { userId } : {});
}
