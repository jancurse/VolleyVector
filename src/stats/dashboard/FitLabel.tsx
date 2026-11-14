import { useEffectEvent, useLayoutEffect, useRef } from "react";
import type { CSSProperties, HTMLAttributes, JSX } from "react";

/** Shows the first of `labels` that fits in the element, or nothing. */
export function FitLabel({
  labels,
  className,
  style,
  ...rest
}: { labels: string[]; className: string; style?: CSSProperties } & HTMLAttributes<HTMLSpanElement>): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  const key = labels.join("|");
  const fit = useEffectEvent((el: HTMLSpanElement) => {
    for (const l of [...labels, ""]) {
      el.textContent = l;
      if (el.scrollWidth <= el.clientWidth) break;
    }
  });

  useLayoutEffect(() => {
    const el = ref.current;

    if (!el) return;

    fit(el);

    const ro = new ResizeObserver(() => fit(el));

    ro.observe(el);

    return () => ro.disconnect();
  }, [key]);

  return <span ref={ref} className={className} style={style} {...rest} />;
}
