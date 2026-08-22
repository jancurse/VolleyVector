import type { JSX } from "react";

import type { Marker } from "../court/types";
import { ToggleGroup } from "../ui/ToggleGroup";

// The two-team switch, shown only while the opponent half is on: it picks the side a pressed role
// adds to (the palette) or moves the selected marker between the teams (the inspector). Our side is
// the absent `side`, so this is also the one place that maps it to and from a toggle value.

const ITEMS = [
  { value: "us", label: "Our team" },
  { value: "opponent", label: "Opponent" },
];

type SideToggleProps = {
  ariaLabel: string;
  value: Marker["side"];
  onChange: (side: Marker["side"]) => void;
};

export function SideToggle({ ariaLabel, value, onChange }: SideToggleProps): JSX.Element {
  return (
    <ToggleGroup
      ariaLabel={ariaLabel}
      items={ITEMS}
      value={value === "opponent" ? "opponent" : "us"}
      onValueChange={(next) => onChange(next === "opponent" ? "opponent" : undefined)}
    />
  );
}
