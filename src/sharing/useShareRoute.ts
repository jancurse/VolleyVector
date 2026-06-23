import { useHashToken } from "../routing/useHashRoute";

// The one client-side route: a share link. Everything else is state-based navigation inside the app, but
// a share link must be openable by URL with no account, so it rides in the hash (which a static host
// serves without rewrite rules). `#/share/<token>` yields the token; any other hash yields null.
const PREFIX = "#/share/";

/** The share token in the URL hash, kept in sync as the hash changes, or null when none is present. */
export function useShareRoute(): string | null {
  return useHashToken(PREFIX);
}
