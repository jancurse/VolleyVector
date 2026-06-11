import { useEffect, useState } from "react";

// The dev-only draft preview rides the hash like the share and invite links, so it layers over any
// path-based page without touching the router. `#/preview` opens it; any other hash does not. The
// route is only ever acted on in dev builds (App checks `import.meta.env.DEV`).
const HASH = "#/preview";

function isOpen(): boolean {
  return window.location.hash === HASH;
}

/** Whether the `#/preview` hash is active, kept in sync as the hash changes. */
export function useDraftPreviewRoute(): boolean {
  const [open, setOpen] = useState(isOpen);

  useEffect(() => {
    const onChange = () => setOpen(isOpen());

    window.addEventListener("hashchange", onChange);

    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return open;
}
