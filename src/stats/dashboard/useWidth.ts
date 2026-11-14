import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/** An element's width, kept current as it resizes, so a chart can draw at its measured size. */
export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;

    if (!el) return;

    const ro = new ResizeObserver(() => setWidth(el.clientWidth));

    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  return [ref, width];
}
