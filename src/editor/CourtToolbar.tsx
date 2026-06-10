import type { JSX } from "react";

import type { CourtMode } from "../court/roles";
import { ToggleGroup } from "../ui/ToggleGroup";
import { GridControl } from "./GridControl";

// One bar of court-level settings beneath the editor's court. It gathers the occasional controls —
// the marker mode and the authoring grid — so each new view setting docks here as another control
// rather than as another stacked row. The always-on affordances (step strip, marker palette) stay
// separate; this is only for set-and-forget options.

const MODE_ITEMS = [
  { value: "positions", label: "Positions" },
  { value: "basic", label: "Basic" },
];

type CourtToolbarProps = {
  mode: CourtMode;
  onModeChange: (mode: CourtMode) => void;
  grid: number;
  onGridChange: (grid: number) => void;
  snap: boolean;
  onSnapChange: (snap: boolean) => void;
};

export function CourtToolbar({
  mode,
  onModeChange,
  grid,
  onGridChange,
  snap,
  onSnapChange,
}: CourtToolbarProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <ToggleGroup
        ariaLabel="Court mode"
        items={MODE_ITEMS}
        value={mode}
        onValueChange={(value) => onModeChange(value as CourtMode)}
      />
      <GridControl divisions={grid} onDivisionsChange={onGridChange} snap={snap} onSnapChange={onSnapChange} />
    </div>
  );
}
