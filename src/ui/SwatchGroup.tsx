import type { ReactNode } from "react";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Radio } from "@base-ui/react/radio";

import { cx, SWATCH_BASE, SWATCH_FLAT } from "./styles";

// A single-choice picker rendered as coloured swatches: exactly one is selected, shown by an accent
// ring. Used for the marker role/colour and annotation colour pickers. A swatch either carries `art`
// filling the disc (the court's own marker/ball glyphs), or renders as a flat CSS disc from its
// fill/ring/text — the role or colour palette applied inline so it stays theme-independent.
export type Swatch = {
  value: string;
  label: string;
  fill?: string;
  ring?: string;
  text?: string;
  /** Optional glyph shown inside a flat swatch (a role code); colours render as blank discs. */
  code?: string;
  /** Custom artwork filling the disc instead of the flat look (the marker and ball swatches). */
  art?: ReactNode;
};

type SwatchGroupProps = {
  value: string;
  onValueChange: (value: string) => void;
  items: readonly Swatch[];
  ariaLabel: string;
};

const SWATCH = cx(
  SWATCH_BASE,
  "cursor-pointer transition-[transform,outline-color] duration-150 ease-settle hover:-translate-y-px data-[checked]:outline-2 data-[checked]:outline-offset-2 data-[checked]:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
);

export function SwatchGroup({ value, onValueChange, items, ariaLabel }: SwatchGroupProps) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onValueChange(next as string)}
      aria-label={ariaLabel}
      className="flex flex-wrap gap-2"
    >
      {items.map((swatch) => (
        <Radio.Root
          key={swatch.value}
          value={swatch.value}
          aria-label={swatch.label}
          className={cx(SWATCH, !swatch.art && SWATCH_FLAT)}
          style={swatch.art ? undefined : { background: swatch.fill, borderColor: swatch.ring, color: swatch.text }}
        >
          {swatch.art ?? swatch.code}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
