import type { JSX, ReactNode } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";

import { cx } from "./styles";

// A left-anchored overlay panel above a scrim, sliding in from the edge. Base UI's Dialog supplies
// the focus trap, focus return, and escape/scrim dismissal. For a centred modal use Dialog instead.
type SidePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The panel's accessible name (it has no visible title). */
  label: string;
  children: ReactNode;
};

const BACKDROP =
  "fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ease-settle data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none";

const PANEL = cx(
  "fixed inset-y-0 left-0 z-40 w-64 overflow-hidden bg-bg shadow-overlay outline-none",
  "transition-transform duration-200 ease-settle data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full motion-reduce:transition-none"
);

export function SidePanel({ open, onOpenChange, label, children }: SidePanelProps): JSX.Element {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={BACKDROP} />
        <BaseDialog.Popup aria-label={label} className={PANEL}>
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
