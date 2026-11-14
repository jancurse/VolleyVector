import { useCallback, useRef, useState } from "react";
import type { JSX } from "react";

import { AlertDialog } from "./AlertDialog";
import { Checkbox } from "./Checkbox";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** A checkbox, ticked to start with, whose state `confirmWith` resolves to. */
  option?: string;
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;
type ConfirmWith = (options: ConfirmOptions) => Promise<{ confirmed: boolean; option: boolean }>;

// Promise-based replacement for window.confirm built on the AlertDialog. Call confirm(options) and
// await the boolean, or confirmWith(options) for its option's checkbox too; render the returned dialog element
// once. The confirm button confirms; dismissing by escape, outside-click, or Cancel does not.
export function useConfirm(): { confirm: Confirm; confirmWith: ConfirmWith; dialog: JSX.Element } {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ title: "" });
  const [option, setOption] = useState(true);
  const resolveRef = useRef<((value: { confirmed: boolean; option: boolean }) => void) | null>(null);

  const confirmWith = useCallback<ConfirmWith>((opts) => {
    setOptions(opts);
    setOption(true);
    setOpen(true);

    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const confirm = useCallback<Confirm>((opts) => confirmWith(opts).then((r) => r.confirmed), [confirmWith]);

  const finish = (confirmed: boolean) => {
    setOpen(false);
    resolveRef.current?.({ confirmed, option });
    resolveRef.current = null;
  };

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
    >
      {options.option && (
        <Checkbox checked={option} onCheckedChange={setOption} ariaLabel={options.option}>
          {options.option}
        </Checkbox>
      )}
    </AlertDialog>
  );

  return { confirm, confirmWith, dialog };
}
