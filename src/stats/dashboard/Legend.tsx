import type { CSSProperties, JSX } from "react";

import { cx } from "../../ui/styles";

export type LegendItem = { swatch: string; label: string; style?: CSSProperties };

/** A chart's key: a swatch and a label per series. */
export function Legend({ items, className }: { items: readonly LegendItem[]; className?: string }): JSX.Element {
  return (
    <div className={cx("flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-dim", className)}>
      {items.map(({ swatch, label, style }) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <i className={swatch} style={style} />
          {label}
        </span>
      ))}
    </div>
  );
}
