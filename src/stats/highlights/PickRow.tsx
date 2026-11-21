import type { JSX, ReactNode } from "react";
import { Check, Minus } from "lucide-react";

import { cx, FILTER_CHECK, FILTER_ROW } from "../../ui/styles";

type PickRowProps = {
  /** Picked, not picked, or "mixed" when only part of what the row stands for is. */
  pressed: boolean | "mixed";
  onToggle: () => void;
  ariaLabel: string;
  /** How many actions picking the row would show. */
  count: number;
  children: ReactNode;
};

/** One value in a filter's picker: a check box, its name, and how many actions it would show. */
export function PickRow({ pressed, onToggle, ariaLabel, count, children }: PickRowProps): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={ariaLabel}
      disabled={!pressed && !count}
      onClick={onToggle}
      className={cx(FILTER_ROW, pressed === true ? "bg-accent-weak" : "hover:not-disabled:bg-control-hover")}
    >
      <span className={FILTER_CHECK} data-on={pressed || undefined}>
        {pressed === true && <Check size={12} strokeWidth={3} aria-hidden="true" />}
        {pressed === "mixed" && <Minus size={12} strokeWidth={3} aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <span className="text-xs text-text-dim tabular-nums">{count}</span>
    </button>
  );
}
