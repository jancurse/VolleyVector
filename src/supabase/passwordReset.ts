import { invokeFunction } from "./invokeFunction";

/**
 * Ask the server to email a password-reset link, via the `request-password-reset` Edge Function. The
 * function is oracle-safe: it returns the same success whether or not an account matched, so there is no
 * outcome to branch on and the request UI shows one neutral confirmation regardless.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await invokeFunction("request-password-reset", { email });
}
