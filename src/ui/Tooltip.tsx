import type { ReactElement, ReactNode } from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";

import { cx, OVERLAY_MOTION } from "./styles";

// A shared delay for every tooltip; once one is open, neighbours open instantly. Mount once near the
// app root so all icon-only controls share it.
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <BaseTooltip.Provider delay={500}>{children}</BaseTooltip.Provider>;
}

type TooltipProps = {
  label: ReactNode;
  /** The trigger element (an icon button); Base UI drives it through its render prop. */
  children: ReactElement;
  side?: "top" | "bottom" | "left" | "right";
};

const POPUP = cx(
  "z-30 max-w-[16rem] rounded-sm border border-border bg-court-surface px-2 py-1 text-xs font-semibold text-text shadow-overlay",
  OVERLAY_MOTION
);

export function Tooltip({ label, children, side = "top" }: TooltipProps) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner sideOffset={8} side={side} className="z-30">
          <BaseTooltip.Popup className={POPUP}>{label}</BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
