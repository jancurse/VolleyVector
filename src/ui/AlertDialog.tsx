import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";

import { Button } from "./Button";
import { BACKDROP, cx, OVERLAY_MOTION, OVERLAY_SURFACE } from "./styles";

// A modal confirmation with a focus trap, focus return, escape/outside-click dismissal, and the title
// wired as its accessible name. Controlled by the caller (see useConfirm).
export type AlertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
};

const POPUP = cx(
  OVERLAY_SURFACE,
  "fixed top-1/2 left-1/2 z-40 -mt-8 flex w-96 max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 p-5 text-text",
  OVERLAY_MOTION
);

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
}: AlertDialogProps) {
  return (
    <BaseAlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseAlertDialog.Portal>
        <BaseAlertDialog.Backdrop className={BACKDROP} />
        <BaseAlertDialog.Popup className={POPUP}>
          <div className="flex flex-col gap-1">
            <BaseAlertDialog.Title className="m-0 font-display text-display-sm font-bold tracking-[-0.015em] text-text">
              {title}
            </BaseAlertDialog.Title>
            {description && (
              <BaseAlertDialog.Description className="m-0 text-base leading-[1.5] text-text-dim">
                {description}
              </BaseAlertDialog.Description>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <BaseAlertDialog.Close
              render={
                <Button variant="ghost" paired>
                  {cancelLabel}
                </Button>
              }
            />
            <Button variant={danger ? "danger-solid" : "primary"} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </BaseAlertDialog.Popup>
      </BaseAlertDialog.Portal>
    </BaseAlertDialog.Root>
  );
}
