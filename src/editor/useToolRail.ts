import { useSyncExternalStore } from "react";

const STACKED_QUERY = "(max-width: 640px)";

// The media-query change events cover real browsers; the extra resize subscription covers test
// environments that only fire resize. Duplicate notifications are deduped by the snapshot value.
function subscribe(onChange: () => void): () => void {
  const list = window.matchMedia(STACKED_QUERY);

  list.addEventListener("change", onChange);
  window.addEventListener("resize", onChange);

  return () => {
    list.removeEventListener("change", onChange);
    window.removeEventListener("resize", onChange);
  };
}

// True while the thin vertical tool rail fits beside the court, so it stays there. This sits far below
// the two-column grid breakpoint: the rail needs only its own ~54px, so it keeps its place long after
// the right sidebar has stacked. Only at phone widths do the tools wrap to a horizontal bar below.
export function useToolRail(): boolean {
  return !useSyncExternalStore(subscribe, () => window.matchMedia(STACKED_QUERY).matches);
}
