import type { JSX } from "react";

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
      <GridIcon />
      Grid
      <span className={cx("font-mono", on ? "text-accent" : "text-text-dim")}>{on ? divisions : "Off"}</span>
      <CaretIcon />
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
          <MagnetIcon />
          Snap to grid
        </Toggle>
      </div>
    </Popover>
  );
}

function GridIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 16 16"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      aria-hidden="true"
    >
      <rect x="2.4" y="2.4" width="11.2" height="11.2" rx="1.6" />
      <path d="M6.13 2.4v11.2M9.87 2.4v11.2M2.4 6.13h11.2M2.4 9.87h11.2" />
    </svg>
  );
}

function CaretIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width={12} height={12} fill="currentColor" aria-hidden="true" className="text-text-dim">
      <path d="M4.5 6.5 8 10l3.5-3.5z" />
    </svg>
  );
}

function MagnetIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.5 3v8a5.5 5.5 0 0 0 11 0V3" />
      <path d="M6.5 8h-2.5M20 8h-2.5" />
    </svg>
  );
}
