import type { JSX, ReactNode } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";

import { BACKDROP, cx, OVERLAY_MOTION, OVERLAY_SURFACE } from "./styles";

// A modal dialog with a focus trap, focus return, and escape/outside-click dismissal, its title wired
// as the accessible name. Controlled by the caller. For a yes/no confirmation use AlertDialog instead.
type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
};

const POPUP = cx(
  OVERLAY_SURFACE,
  "fixed top-1/2 left-1/2 z-40 flex max-h-[calc(100vh-3rem)] w-[30rem] max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto p-5 text-text",
  OVERLAY_MOTION
);

export function Dialog({ open, onOpenChange, title, children }: DialogProps): JSX.Element {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={BACKDROP} />
        <BaseDialog.Popup className={POPUP}>
          <BaseDialog.Title className="m-0 font-display text-display-sm font-bold tracking-[-0.015em] text-text">
            {title}
          </BaseDialog.Title>
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
