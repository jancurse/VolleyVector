import { useCallback, useEffect, useState } from "react";

import { buildPath, parsePath, type Route } from "./route";

export type Navigate = (route: Route, options?: { replace?: boolean }) => void;

/** The live path-based route, kept in sync with the History API. `navigate` pushes (or replaces) a new
 *  route through `pushState`/`replaceState`; the browser back/forward buttons drive `popstate`. The hash
 *  routes (share, invite) are handled separately and ignored here. */
export function useRoute(): { route: Route; navigate: Navigate } {
  const [route, setRoute] = useState<Route>(() => parsePath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setRoute(parsePath(window.location.pathname));

    window.addEventListener("popstate", onPopState);

    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback<Navigate>((next, options) => {
    const path = buildPath(next);

    if (path !== window.location.pathname) {
      if (options?.replace) window.history.replaceState(null, "", path);
      else window.history.pushState(null, "", path);
    }

    setRoute(next);
  }, []);

  return { route, navigate };
}
