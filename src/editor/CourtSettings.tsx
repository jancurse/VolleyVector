import type { JSX } from "react";
import { Magnet, Settings2 } from "lucide-react";

import type { CourtMode } from "../court/roles";
import { Popover } from "../ui/Popover";
import { Toggle } from "../ui/Toggle";
import { ToggleGroup } from "../ui/ToggleGroup";
import { ToolbarButton } from "../ui/Toolbar";
import { FIELD_LABEL } from "../ui/styles";
import { TOOL_BUTTON } from "./AnnotationToolbar";

// The editor's set-and-forget court options behind one gear: the marker mode, the authoring grid
// (off, or 3/9/27 cells per axis — powers of three that all keep a line on the 1/3 attack line) with
// its magnetic snap, the opponent half, and on a Sequence the derived movement arrows. The grid and
// snap are editor-only aids and never touch the saved board; snapping nudges a dragged marker onto
// nearby gridlines while arrow-key nudges stay free, so fine off-grid placement is always one
// keypress away.

const MODE_ITEMS = [
  { value: "positions", label: "Positions" },
  { value: "basic", label: "Basic" },
];

const GRID_ITEMS = [
  { value: "0", label: "Off" },
  { value: "3", label: "3" },
  { value: "9", label: "9" },
  { value: "27", label: "27" },
];

const ON_OFF_ITEMS = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
];

type CourtSettingsProps = {
  mode: CourtMode;
  onModeChange: (mode: CourtMode) => void;
  grid: number;
  onGridChange: (grid: number) => void;
  snap: boolean;
  onSnapChange: (snap: boolean) => void;
  /** Present on a Sequence: the derived movement-arrow toggle. */
  autoArrows?: { value: boolean; onChange: (on: boolean) => void };
  /** The opponent half: on shows it and lets markers be added to it. */
  opponentSide: { value: boolean; onChange: (on: boolean) => void };
  /** Which way the panel opens: rightward off the vertical rail, or below the horizontal toolbar. */
  side?: "right" | "bottom";
};

export function CourtSettings({
  mode,
  onModeChange,
  grid,
  onGridChange,
  snap,
  onSnapChange,
  autoArrows,
  opponentSide,
  side = "bottom",
}: CourtSettingsProps): JSX.Element {
  const gridOn = grid > 0;

  return (
    <Popover
      ariaLabel="Court settings"
      side={side}
      trigger={
        <ToolbarButton aria-label="Court settings" className={TOOL_BUTTON}>
          <Settings2 size={17} aria-hidden="true" />
        </ToolbarButton>
      }
    >
      <div className="flex w-[12.5rem] flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>Court mode</span>
          <ToggleGroup
            ariaLabel="Court mode"
            items={MODE_ITEMS}
            value={mode}
            onValueChange={(value) => onModeChange(value as CourtMode)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>Grid cells per axis</span>
          <ToggleGroup
            ariaLabel="Court grid"
            items={GRID_ITEMS}
            value={String(grid)}
            onValueChange={(value) => onGridChange(Number(value))}
          />
        </div>
        <Toggle pressed={gridOn && snap} disabled={!gridOn} onPressedChange={onSnapChange} ariaLabel="Snap to grid">
          <Magnet size={14} aria-hidden="true" />
          Snap to grid
        </Toggle>
        <div className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>Opponent side</span>
          <ToggleGroup
            ariaLabel="Opponent side"
            items={ON_OFF_ITEMS}
            value={opponentSide.value ? "on" : "off"}
            onValueChange={(value) => opponentSide.onChange(value === "on")}
          />
        </div>
        {autoArrows && (
          <div className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>Auto arrows</span>
            <ToggleGroup
              ariaLabel="Auto arrows"
              items={ON_OFF_ITEMS}
              value={autoArrows.value ? "on" : "off"}
              onValueChange={(value) => autoArrows.onChange(value === "on")}
            />
          </div>
        )}
      </div>
    </Popover>
  );
}
