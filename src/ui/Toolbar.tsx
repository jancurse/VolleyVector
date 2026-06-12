import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Toolbar as BaseToolbar } from "@base-ui/react/toolbar";

import { cx, iconButtonClass } from "./styles";
import type { IconButtonSize, IconButtonVariant } from "./styles";
import { Tooltip } from "./Tooltip";

// A group of controls with roving arrow-key focus. Children should be ToolbarButtons so focus moves
// across them with one Tab stop into the group.
export function Toolbar({
  children,
  ariaLabel,
  className,
  orientation = "horizontal",
}: {
  children: ReactNode;
  ariaLabel: string;
  className?: string;
  /** Layout direction; also sets the roving-focus arrow axis. */
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <BaseToolbar.Root
      aria-label={ariaLabel}
      orientation={orientation}
      className={cx("flex items-center", orientation === "vertical" && "flex-col", className)}
    >
      {children}
    </BaseToolbar.Root>
  );
}

type ToolbarButtonProps = ComponentPropsWithoutRef<"button"> & {
  "aria-label": string;
  /** Tooltip text; omit for none. Icon-only controls should always pass one. */
  tooltip?: string;
  tooltipSide?: "top" | "bottom" | "left" | "right";
  /** When set, applies the shared icon-button look; otherwise the caller supplies className. */
  icon?: { variant?: IconButtonVariant; size?: IconButtonSize };
};

export function ToolbarButton({ tooltip, tooltipSide, icon, className, ...props }: ToolbarButtonProps) {
  const look = icon ? iconButtonClass(icon.variant ?? "control", icon.size ?? "md") : "";
  const button = <BaseToolbar.Button className={cx(look, className)} {...props} />;

  return tooltip ? (
    <Tooltip label={tooltip} side={tooltipSide}>
      {button}
    </Tooltip>
  ) : (
    button
  );
}
