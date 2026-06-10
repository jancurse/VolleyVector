import { useSyncExternalStore } from "react";

export type SidebarMode = "full" | "rail" | "drawer";

const FULL_QUERY = "(min-width: 1400px)";
const RAIL_QUERY = "(min-width: 960px)";

// The media-query change events cover real browsers; the extra resize subscription covers test
// environments that only fire resize. Duplicate notifications are deduped by the snapshot value.
function subscribe(onChange: () => void): () => void {
  const lists = [window.matchMedia(FULL_QUERY), window.matchMedia(RAIL_QUERY)];

  lists.forEach((list) => list.addEventListener("change", onChange));
  window.addEventListener("resize", onChange);

  return () => {
    lists.forEach((list) => list.removeEventListener("change", onChange));
    window.removeEventListener("resize", onChange);
  };
}

function snapshot(): SidebarMode {
  if (window.matchMedia(FULL_QUERY).matches) return "full";

  return window.matchMedia(RAIL_QUERY).matches ? "rail" : "drawer";
}

/** The shell's sidebar presentation: the full column, the slim icon rail, or a drawer behind a top-bar toggle. */
export function useSidebarMode(): SidebarMode {
  return useSyncExternalStore(subscribe, snapshot);
}
