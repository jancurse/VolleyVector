import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** Tracks the OS "reduce motion" preference, so a surface can hold still instead of auto-animating. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const query = window.matchMedia(QUERY);
    const onChange = () => setReduced(query.matches);

    query.addEventListener("change", onChange);

    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
