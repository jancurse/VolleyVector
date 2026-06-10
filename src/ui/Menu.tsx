import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";
import { Menu as BaseMenu } from "@base-ui/react/menu";

import { cx, OVERLAY, OVERLAY_ITEM, OVERLAY_MOTION } from "./styles";
import { Tooltip } from "./Tooltip";

// A dropdown menu of actions with full keyboard navigation and escape/outside-click dismissal. The
// trigger is supplied by the caller (a plain icon/button); when a tooltip is given it composes around
// the trigger so the same element anchors both the menu and the tooltip.
type MenuProps = {
  trigger: ReactElement;
  children: ReactNode;
  tooltip?: string;
  align?: "start" | "center" | "end";
};

export function Menu({ trigger, children, tooltip, align = "end" }: MenuProps) {
  const triggerNode = <BaseMenu.Trigger render={trigger} />;

  return (
    <BaseMenu.Root>
      {tooltip ? <Tooltip label={tooltip}>{triggerNode}</Tooltip> : triggerNode}
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={8} align={align} className="z-30 outline-none">
          <BaseMenu.Popup className={cx(OVERLAY, "flex min-w-[184px] flex-col gap-px", OVERLAY_MOTION)}>
            {children}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

export function MenuItem({
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<typeof BaseMenu.Item>, "className"> & { className?: string }) {
  return <BaseMenu.Item className={cx(OVERLAY_ITEM, className)} {...props} />;
}
