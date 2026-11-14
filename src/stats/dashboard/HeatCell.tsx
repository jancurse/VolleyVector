import type { JSX, ReactNode } from "react";

import { cx } from "../../ui/styles";
import type { Tip, TipContent } from "./tip";

/** A cell of the player grid, shaded towards our colour when positive and the danger colour when negative. */
export function HeatCell({
  value,
  max,
  tip,
  content,
  children,
}: {
  value: number;
  max: number;
  tip: Tip;
  content: TipContent;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="relative rounded-xs px-2 py-1 whitespace-nowrap print:px-1 print:py-0.5" {...tip(content)}>
      <i
        className={cx("absolute inset-0 rounded-xs", value >= 0 ? "bg-chart-us" : "bg-chart-bad")}
        style={{ opacity: 0.12 + (0.6 * Math.abs(value)) / max }}
      />
      <span className="relative">{children}</span>
    </div>
  );
}
