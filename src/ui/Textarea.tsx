import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

import { cx } from "./styles";

// The markdown editing field. It grows with its content from the size's floor up to a 60vh cap
// (field-sizing; older browsers keep the floor and scroll internally). The compact size is the
// shorter step-instruction field that sits beside the fuller description.
type TextareaProps = ComponentPropsWithoutRef<"textarea"> & {
  compact?: boolean;
};

const BASE =
  "w-full resize-y field-sizing-content max-h-[60vh] border border-border bg-control text-text font-ui text-base leading-[1.55] px-3 py-3 rounded-lg transition-[border-color] duration-150 ease-settle focus:outline-none focus:border-accent placeholder:text-text-dim";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { compact = false, className, ...props },
  ref
) {
  return <textarea ref={ref} className={cx(BASE, compact ? "min-h-[96px]" : "min-h-[190px]", className)} {...props} />;
});
