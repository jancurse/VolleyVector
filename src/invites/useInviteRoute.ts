import { useHashToken } from "../routing/useHashRoute";

// An invite link, like a share link, must be openable by URL with no account, so it rides in the hash
// (which a static host serves without rewrite rules). `#/invite/<token>` yields the token; any other
// hash yields null.
const PREFIX = "#/invite/";

/** The invite token in the URL hash, kept in sync as the hash changes, or null when none is present. */
export function useInviteRoute(): string | null {
  return useHashToken(PREFIX);
}
