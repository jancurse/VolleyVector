import type { JSX } from "react";

/** The net above a court diagram: a caption over a heavy rule, spanning the court's columns. */
export function NetLabel(): JSX.Element {
  return <div className="col-span-full border-b-3 border-chart-axis pb-0.5 text-center text-xs text-text-dim">Net</div>;
}
