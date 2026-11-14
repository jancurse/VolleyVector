import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

import { cx } from "./styles";

// A slider over a number range (the video seek bar), in the accent colour.
type RangeProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & { "aria-label": string };

export const Range = forwardRef<HTMLInputElement, RangeProps>(function Range({ className, ...props }, ref) {
  return <input ref={ref} type="range" className={cx("w-full cursor-pointer accent-accent", className)} {...props} />;
});
