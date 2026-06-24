import { useEffect, useState } from "react";

// The "Try it" sandbox is openable by URL with no account, so it rides in the hash (which a static host
// serves without rewrite rules), like the share and invite links. `#/try` opens it; any other hash does
// not. Being a route means a refresh keeps the visitor in the sandbox.
const TRY_HASH = "#/try";

function readOpen(): boolean {
  return window.location.hash === TRY_HASH;
}

/** Open the sandbox by setting the hash; leaving clears it. */
export function openTry(): void {
  window.location.hash = TRY_HASH.slice(1);
}

export function closeTry(): void {
  if (readOpen()) window.location.hash = "";
}

/** Whether the `#/try` sandbox route is active, kept in sync as the hash changes. */
export function useTryRoute(): boolean {
  const [open, setOpen] = useState(readOpen);

  useEffect(() => {
    const onChange = () => setOpen(readOpen());

    window.addEventListener("hashchange", onChange);

    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return open;
}
