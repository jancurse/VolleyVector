import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cx } from "./styles";

// A single checkbox, with its label beside it (the signup Terms acceptance) or alone (a table row's pick). The
// box itself is the toggle target, so the adjacent text may hold its own links (e.g. to the Terms page) without
// nesting interactive elements.
type CheckboxProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
  children?: ReactNode;
};

const BOX = cx(
  "grid size-5 flex-none cursor-pointer place-items-center rounded-sm border border-border bg-control text-on-accent",
  "transition-colors duration-150 ease-settle data-[checked]:border-accent data-[checked]:bg-accent",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-40"
);

export function Checkbox({ checked, onCheckedChange, ariaLabel, disabled, children }: CheckboxProps) {
  const box = (
    <BaseCheckbox.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cx(BOX, children !== undefined && "mt-0.5")}
    >
      <BaseCheckbox.Indicator className="flex">
        <Check size={13} strokeWidth={3} aria-hidden="true" />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );

  return children === undefined ? (
    box
  ) : (
    <div className="flex items-start gap-2.5 text-sm text-text">
      {box}
      <span className="leading-snug">{children}</span>
    </div>
  );
}
