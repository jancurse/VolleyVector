import { useHashToken } from "../routing/useHashRoute";

// A grant link rides in the hash so it is openable by URL on a static host. Unlike a share or invite
// link it needs an account (the grant binds to the redeemer), so it does not bypass the login gate:
// `#/grant/<token>` yields the token, and App redeems it only once the visitor is signed in.
const PREFIX = "#/grant/";

/** The grant token in the URL hash, kept in sync as the hash changes, or null when none is present. */
export function useGrantRoute(): string | null {
  return useHashToken(PREFIX);
}
