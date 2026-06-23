import { supabase } from "../supabase/client";
import { LEGAL_VERSION } from "./legalText";

// Persist the signed-in caller's acceptance of the current Terms & Privacy version, stamped server-side by
// the `accept_terms` RPC. Best-effort: the checkbox already recorded consent in the UI, so a failed write
// must not block the account from finishing signup.
export async function recordTermsAcceptance(): Promise<void> {
  await supabase.rpc("accept_terms", { version: LEGAL_VERSION });
}
