import { useEffect, useState } from "react";

// An invite link, like a share link, must be openable by URL with no account, so it rides in the hash
// (which a static host serves without rewrite rules). `#/invite/<token>` yields the token; any other
// hash yields null.
const PREFIX = "#/invite/";

function readToken(): string | null {
  return window.location.hash.startsWith(PREFIX) ? decodeURIComponent(window.location.hash.slice(PREFIX.length)) : null;
}

/** The invite token in the URL hash, kept in sync as the hash changes, or null when none is present. */
export function useInviteRoute(): string | null {
  const [token, setToken] = useState<string | null>(readToken);

  useEffect(() => {
    const onChange = () => setToken(readToken());

    window.addEventListener("hashchange", onChange);

    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return token;
}
