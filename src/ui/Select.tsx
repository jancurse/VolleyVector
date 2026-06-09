import type { CSSProperties } from "react";
import { Select as BaseSelect } from "@base-ui/react/select";
import { Check, ChevronsUpDown } from "lucide-react";

import { cx, OVERLAY, OVERLAY_MOTION } from "./styles";

// A styled single-select over a flat option list. Options carry an optional depth so a tree renders as
// real indentation rather than leading spaces. An empty-string value is a valid option (the "none"
// row), so callers map their null to "".
export type SelectOption = { value: string; label: string; depth?: number };

type SelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  ariaLabel: string;
};

const TRIGGER =
  "flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-border bg-control px-2.5 py-2 font-ui text-base text-text transition-colors duration-150 ease-settle hover:bg-control-hover focus-visible:border-accent focus-visible:outline-none data-[popup-open]:border-accent";

const ITEM =
  "flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 text-left font-ui text-base text-text outline-none select-none data-[highlighted]:bg-control-hover";

export function Select({ value, onValueChange, options, ariaLabel }: SelectProps) {
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));

  return (
    <BaseSelect.Root items={items} value={value} onValueChange={(next) => onValueChange(next as string)}>
      <BaseSelect.Trigger className={TRIGGER} aria-label={ariaLabel}>
        <BaseSelect.Value className="truncate" />
        <BaseSelect.Icon className="shrink-0 text-text-dim">
          <ChevronsUpDown size={14} aria-hidden="true" className="block" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        {/* z-50 so the popup clears the z-40 modal layer when the Select is used inside a Dialog. */}
        <BaseSelect.Positioner sideOffset={6} alignItemWithTrigger={false} className="z-50 outline-none">
          <BaseSelect.Popup
            className={cx(
              OVERLAY,
              "max-h-[var(--available-height)] min-w-[var(--anchor-width)] flex-col gap-px overflow-y-auto",
              OVERLAY_MOTION
            )}
          >
            {options.map((option) => (
              <BaseSelect.Item
                key={option.value}
                value={option.value}
                className={ITEM}
                style={{ paddingLeft: `${0.55 + (option.depth ?? 0) * 0.9}rem` } as CSSProperties}
              >
                <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
                <BaseSelect.ItemIndicator className="ml-auto flex text-accent">
                  <Check size={14} aria-hidden="true" className="block" />
                </BaseSelect.ItemIndicator>
              </BaseSelect.Item>
            ))}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
