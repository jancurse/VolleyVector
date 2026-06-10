// Did this page load from a Supabase invite email? Its magic link lands here with the freshly created
// session in the URL hash and `type=invite`. We must read that synchronously at module load, because
// supabase-js consumes and clears the hash the moment it initialises, well before the app decides what to
// show. The app uses this to collect a password for the new account, which the invite leaves unset.
export function inviteLandingFromHash(hash: string): boolean {
  return new URLSearchParams(hash.replace(/^#/, "")).get("type") === "invite";
}

export const isInviteLanding = typeof window !== "undefined" && inviteLandingFromHash(window.location.hash);
