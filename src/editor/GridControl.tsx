import type { JSX } from "react";
import { ChevronDown, Grid3x3, Magnet } from "lucide-react";

import { cx, FIELD_LABEL } from "../ui/styles";
import { Popover } from "../ui/Popover";
import { Toggle } from "../ui/Toggle";
import { ToggleGroup } from "../ui/ToggleGroup";

// The court's authoring grid, as a single toolbar control. The trigger shows the current fineness at a
// glance; the popover holds the rest — a fineness picker (off, or 3/9/27 cells per axis over the 9 m
// court, powers of three that all keep a line on the 1/3 attack line) and a magnetic snap switch that
// only applies while a grid is shown. Both are editor-only aids and never touch the saved board.
// Snapping nudges a dragged marker onto nearby gridlines; arrow-key nudges stay free, so fine off-grid
// placement is always one keypress away.

const GRID_ITEMS = [
  { value: "0", label: "Off" },
  { value: "3", label: "3" },
  { value: "9", label: "9" },
  { value: "27", label: "27" },
];

const TRIGGER =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-control px-2.5 py-1.5 font-ui text-sm font-semibold text-text-dim transition-colors duration-150 ease-settle hover:bg-control-hover hover:text-text data-[popup-open]:border-accent data-[popup-open]:text-text";

type GridControlProps = {
  divisions: number;
  onDivisionsChange: (divisions: number) => void;
  snap: boolean;
  onSnapChange: (snap: boolean) => void;
};

export function GridControl({ divisions, onDivisionsChange, snap, onSnapChange }: GridControlProps): JSX.Element {
  const on = divisions > 0;

  const trigger = (
    <button type="button" className={TRIGGER}>
      <Grid3x3 size={14} aria-hidden="true" />
      Grid
      <span className={cx("font-mono", on ? "text-accent" : "text-text-dim")}>{on ? divisions : "Off"}</span>
      <ChevronDown size={12} aria-hidden="true" className="text-text-dim" />
    </button>
  );

  return (
    <Popover trigger={trigger} ariaLabel="Court grid options">
      <div className="flex w-[12.5rem] flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>Cells per axis</span>
          <ToggleGroup
            ariaLabel="Court grid"
            items={GRID_ITEMS}
            value={String(divisions)}
            onValueChange={(value) => onDivisionsChange(Number(value))}
          />
        </div>
        <Toggle pressed={on && snap} disabled={!on} onPressedChange={onSnapChange} ariaLabel="Snap to grid">
          <Magnet size={14} aria-hidden="true" />
          Snap to grid
        </Toggle>
      </div>
    </Popover>
  );
}
