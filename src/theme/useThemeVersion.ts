import { useEffect, useReducer } from "react";

/** A count that goes up whenever the page's theme changes, so what holds resolved colours (a canvas) redraws. */
export function useThemeVersion(): number {
  const [version, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const observer = new MutationObserver(bump);

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => observer.disconnect();
  }, []);

  return version;
}
