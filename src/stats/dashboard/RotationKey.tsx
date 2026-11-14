import type { JSX } from "react";

import { cx, HEAT_SCALE } from "../../ui/styles";

/** The rotations' shading key: the danger colour at 0% won, neutral at half, our colour at 100%. */
export function RotationKey(): JSX.Element {
  return (
    <div className="grid w-40 grid-cols-3 text-xs text-text-dim">
      <i className={cx("col-span-full h-2.5 rounded-xs border border-border", HEAT_SCALE)} />
      <span>0%</span>
      <span className="text-center">50%</span>
      <span className="text-right">100%</span>
    </div>
  );
}
