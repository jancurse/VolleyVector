import type { JSX, ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";

import { Popover } from "../../ui/Popover";
import { FILTER_CLEAR, FILTER_PILL, FILTER_TRIGGER } from "../../ui/styles";

type FilterControlProps = {
  label: string;
  /** What is picked, as the control names it; empty when nothing is. */
  picked: readonly string[];
  onClear: () => void;
  /** Control whether the picker is open, e.g. to open it from a shortcut. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The picker the control opens. */
  children: ReactNode;
};

/** One filter of the highlights' bar: its name opens its picker, and once something is picked it shows that. */
export function FilterControl({
  label,
  picked,
  onClear,
  open,
  onOpenChange,
  children,
}: FilterControlProps): JSX.Element {
  const on = picked.length > 0;

  return (
    <span className={FILTER_PILL} data-on={on || undefined}>
      <Popover
        ariaLabel={label}
        align="start"
        open={open}
        onOpenChange={onOpenChange}
        trigger={
          <button type="button" className={FILTER_TRIGGER} title={on ? picked.join("\n") : undefined}>
            <span className={on ? "font-medium" : undefined}>{label}</span>
            {on && <span className="max-w-44 truncate text-text">{picked[0]}</span>}
            {picked.length > 1 && <span className="text-text tabular-nums">+{picked.length - 1}</span>}
            {!on && <ChevronDown size={14} aria-hidden="true" />}
          </button>
        }
      >
        {children}
      </Popover>
      {on && (
        <button type="button" className={FILTER_CLEAR} aria-label={`Clear ${label.toLowerCase()}`} onClick={onClear}>
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
