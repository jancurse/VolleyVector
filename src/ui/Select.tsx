import type { CSSProperties } from "react";
import { Select as BaseSelect } from "@base-ui/react/select";

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
          <CaretIcon />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={6} alignItemWithTrigger={false} className="z-30 outline-none">
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
                  <CheckIcon />
                </BaseSelect.ItemIndicator>
              </BaseSelect.Item>
            ))}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}

function CaretIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="block">
      <path d="M11 10H5l3 3.5zm0-4H5l3-3.5z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      className="block"
    >
      <path d="m2.5 8.5 4 4 7-9" strokeWidth={1.6} />
    </svg>
  );
}
