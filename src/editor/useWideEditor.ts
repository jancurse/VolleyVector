import { useSyncExternalStore } from "react";

const NARROW_QUERY = "(max-width: 1040px)";

// The media-query change events cover real browsers; the extra resize subscription covers test
// environments that only fire resize. Duplicate notifications are deduped by the snapshot value.
function subscribe(onChange: () => void): () => void {
  const list = window.matchMedia(NARROW_QUERY);

  list.addEventListener("change", onChange);
  window.addEventListener("resize", onChange);

  return () => {
    list.removeEventListener("change", onChange);
    window.removeEventListener("resize", onChange);
  };
}

/** True at the editor's two-column widths — the exact complement of the `max-[1040px]` breakpoint. */
export function useWideEditor(): boolean {
  return useSyncExternalStore(subscribe, () => !window.matchMedia(NARROW_QUERY).matches);
}
