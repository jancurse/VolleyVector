import { useEffect, useState } from "react";

// A grant link rides in the hash so it is openable by URL on a static host. Unlike a share or invite
// link it needs an account (the grant binds to the redeemer), so it does not bypass the login gate:
// `#/grant/<token>` yields the token, and App redeems it only once the visitor is signed in.
const PREFIX = "#/grant/";

function readToken(): string | null {
  return window.location.hash.startsWith(PREFIX) ? decodeURIComponent(window.location.hash.slice(PREFIX.length)) : null;
}

/** The grant token in the URL hash, kept in sync as the hash changes, or null when none is present. */
export function useGrantRoute(): string | null {
  const [token, setToken] = useState<string | null>(readToken);

  useEffect(() => {
    const onChange = () => setToken(readToken());

    window.addEventListener("hashchange", onChange);

    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return token;
}
