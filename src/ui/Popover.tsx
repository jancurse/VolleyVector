import type { ReactElement, ReactNode } from "react";
import { Popover as BasePopover } from "@base-ui/react/popover";

import { cx, OVERLAY_MOTION, OVERLAY_SURFACE } from "./styles";

// A floating panel of arbitrary content anchored to a trigger, with focus management and
// escape/outside-click dismissal. Unlike Menu (a list of actions) it holds free-form controls, so it
// is the home for compact settings clusters like the court's grid options.
type PopoverProps = {
  trigger: ReactElement;
  children: ReactNode;
  /** Accessible name for the panel. */
  ariaLabel?: string;
  align?: "start" | "center" | "end";
};

export function Popover({ trigger, children, ariaLabel, align = "center" }: PopoverProps) {
  return (
    <BasePopover.Root>
      <BasePopover.Trigger render={trigger} />
      <BasePopover.Portal>
        <BasePopover.Positioner sideOffset={8} align={align} className="z-30 outline-none">
          <BasePopover.Popup aria-label={ariaLabel} className={cx(OVERLAY_SURFACE, "p-3", OVERLAY_MOTION)}>
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}
