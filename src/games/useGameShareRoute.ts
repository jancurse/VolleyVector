import { useHashToken } from "../routing/useHashRoute";

// A game's share link, openable by URL with no account, so it rides in the hash like a board's.
// `#/game/<token>` yields the token; any other hash yields null.
const PREFIX = "#/game/";

/** The game share token in the URL hash, kept in sync as the hash changes, or null when none is present. */
export function useGameShareRoute(): string | null {
  return useHashToken(PREFIX);
}
