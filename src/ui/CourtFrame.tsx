import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

import { cx } from "./styles";

// The rounded, raised surface that frames a Court. Shared by the board view and editor; the editor
// also makes it focusable (tabIndex + onKeyDown) to nudge a selected marker with the arrow keys.
type CourtFrameProps = ComponentPropsWithoutRef<"figure"> & {
  /** Width class; defaults to the standalone cap. Pass "w-full" when a parent owns the sizing. */
  width?: string;
};

const FRAME =
  "m-0 aspect-square max-w-full rounded-3xl border border-border bg-court-surface shadow-court transition-[background-color,border-color] duration-[400ms] animate-[rise_0.7s_var(--ease-settle)_both] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-accent-weak motion-reduce:animate-none";

export const CourtFrame = forwardRef<HTMLElement, CourtFrameProps>(function CourtFrame(
  { className, width = "w-[min(74vh,620px)]", ...props },
  ref
) {
  return <figure ref={ref} className={cx(FRAME, width, className)} {...props} />;
});
