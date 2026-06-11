import type { ReactNode } from "react";
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import { Toggle } from "@base-ui/react/toggle";

import { cx, TOGGLE_PILL } from "./styles";

// A group of toggle buttons with arrow-key navigation. The segmented variant is the boxed control
// (type filter, mode switch); the pills variant is the wrapped tag filter. Single mode keeps one item
// pressed at all times (deselecting the active one is ignored); multiple mode is a free intersection.
// An icon-only item passes the glyph as `label` and names itself via `ariaLabel`.
type Item = { value: string; label: ReactNode; ariaLabel?: string; disabled?: boolean };

type Variant = "segmented" | "pills";

type Common = {
  items: readonly Item[];
  ariaLabel: string;
  variant?: Variant;
};

type ToggleGroupProps =
  | (Common & { multiple?: false; value: string; onValueChange: (value: string) => void })
  | (Common & { multiple: true; value: string[]; onValueChange: (value: string[]) => void });

const GROUP: Record<Variant, string> = {
  segmented: "inline-flex gap-0.5 rounded-md border border-border bg-control p-0.5",
  pills: "flex flex-wrap gap-1.5",
};

const TOGGLE: Record<Variant, string> = {
  segmented:
    "cursor-pointer rounded-sm border-0 bg-transparent px-2.5 py-1 font-ui text-sm font-semibold text-text-dim transition-colors duration-150 ease-settle hover:not-disabled:text-text data-[pressed]:bg-bg data-[pressed]:text-text disabled:cursor-default disabled:opacity-40",
  pills: TOGGLE_PILL,
};

export function ToggleGroup(props: ToggleGroupProps) {
  const { items, ariaLabel, variant = "segmented" } = props;
  const value = props.multiple ? props.value : [props.value];

  const handleChange = (next: string[]) => {
    if (props.multiple) {
      props.onValueChange(next);

      return;
    }

    const picked = next[0];

    if (picked) props.onValueChange(picked);
  };

  return (
    <BaseToggleGroup
      value={value}
      onValueChange={handleChange}
      multiple={props.multiple}
      aria-label={ariaLabel}
      className={GROUP[variant]}
    >
      {items.map((item) => (
        <Toggle
          key={item.value}
          value={item.value}
          aria-label={item.ariaLabel}
          disabled={item.disabled}
          className={cx(TOGGLE[variant])}
        >
          {item.label}
        </Toggle>
      ))}
    </BaseToggleGroup>
  );
}
