import { useEffect, useState } from "react";

// The one client-side route: a share link. Everything else is state-based navigation inside the app, but
// a share link must be openable by URL with no account, so it rides in the hash (which a static host
// serves without rewrite rules). `#/share/<token>` yields the token; any other hash yields null.
const PREFIX = "#/share/";

function readToken(): string | null {
  return window.location.hash.startsWith(PREFIX) ? decodeURIComponent(window.location.hash.slice(PREFIX.length)) : null;
}

/** The share token in the URL hash, kept in sync as the hash changes, or null when none is present. */
export function useShareRoute(): string | null {
  const [token, setToken] = useState<string | null>(readToken);

  useEffect(() => {
    const onChange = () => setToken(readToken());

    window.addEventListener("hashchange", onChange);

    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return token;
}
