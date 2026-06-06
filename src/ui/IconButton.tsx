import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

import { cx, iconButtonClass } from "./styles";
import type { IconButtonSize, IconButtonVariant } from "./styles";
import { Tooltip } from "./Tooltip";

// A square icon-only button. Every icon-only control renders through this, so they share one look and
// each gets a tooltip. `aria-label` is required since there is no visible text; the tooltip defaults
// to it. Forwards its ref and spreads props so Base UI primitives can drive it via `render`.
type IconButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  "aria-label": string;
  /** Tooltip text; defaults to the aria-label. Pass null to omit the tooltip. */
  tooltip?: string | null;
  tooltipSide?: "top" | "bottom" | "left" | "right";
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = "control", size = "md", type = "button", className, tooltip, tooltipSide = "top", ...props },
  ref
) {
  const button = <button ref={ref} type={type} className={cx(iconButtonClass(variant, size), className)} {...props} />;

  const text = tooltip === undefined ? props["aria-label"] : tooltip;

  if (!text) return button;

  return (
    <Tooltip label={text} side={tooltipSide}>
      {button}
    </Tooltip>
  );
});
