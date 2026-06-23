import { invokeFunction } from "./invokeFunction";

// Restoring a soft-deleted account runs server-side in the `restore-account` Edge Function (admin-only):
// it un-bans the auth user and clears the profile's deletion flag. The client only forwards the request.
export function restoreAccount(userId: string): Promise<{ error: string | null }> {
  return invokeFunction("restore-account", { userId });
}
