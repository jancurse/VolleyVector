import { useCallback, useRef, useState } from "react";
import type { JSX } from "react";

import { AlertDialog } from "./AlertDialog";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

// Promise-based replacement for window.confirm built on the AlertDialog. Call confirm(options) and
// await the boolean; render the returned dialog element once. The confirm button resolves true;
// dismissing by escape, outside-click, or Cancel resolves false.
export function useConfirm(): { confirm: Confirm; dialog: JSX.Element } {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ title: "" });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((opts) => {
    setOptions(opts);
    setOpen(true);

    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const finish = useCallback((result: boolean) => {
    setOpen(false);
    resolveRef.current?.(result);
    resolveRef.current = null;
  }, []);

  const dialog = (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Base UI requests a close (Cancel, escape, outside-click) — resolve as cancelled.
        if (!next) finish(false);
      }}
      onConfirm={() => finish(true)}
      title={options.title}
      description={options.description}
      confirmLabel={options.confirmLabel}
      cancelLabel={options.cancelLabel}
      danger={options.danger}
    />
  );

  return { confirm, dialog };
}
