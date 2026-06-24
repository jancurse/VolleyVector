import { useEffect, useState } from "react";

// The hash-route primitives shared by the share, grant, invite, and draft-preview hooks. Each of those
// is a client-side route that must layer over the path-based router on a static host: it rides in the
// URL hash (which a static host serves without rewrite rules) and stays in sync as the hash changes.

function tokenFor(prefix: string): string | null {
  return window.location.hash.startsWith(prefix) ? decodeURIComponent(window.location.hash.slice(prefix.length)) : null;
}

/** The token after `prefix` in the URL hash, kept in sync as the hash changes, or null when absent. */
export function useHashToken(prefix: string): string | null {
  const [token, setToken] = useState<string | null>(() => tokenFor(prefix));

  useEffect(() => {
    const onChange = () => setToken(tokenFor(prefix));

    window.addEventListener("hashchange", onChange);

    return () => window.removeEventListener("hashchange", onChange);
  }, [prefix]);

  return token;
}

/** Whether the URL hash exactly equals `hash`, kept in sync as the hash changes. */
export function useHashMatch(hash: string): boolean {
  const [open, setOpen] = useState(() => window.location.hash === hash);

  useEffect(() => {
    const onChange = () => setOpen(window.location.hash === hash);

    window.addEventListener("hashchange", onChange);

    return () => window.removeEventListener("hashchange", onChange);
  }, [hash]);

  return open;
}
