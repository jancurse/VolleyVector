import type { JSX } from "react";

import { BallSwatch } from "../court/BallArt";
import { MarkerSwatch } from "../court/MarkerSwatch";
import type { CourtMode, MarkerRole } from "../court/roles";
import { MODE_ROLES, ROLES } from "../court/roles";
import type { Marker } from "../court/types";
import { ToggleGroup } from "../ui/ToggleGroup";
import { LEGEND_BUTTON, SWATCH_BASE } from "../ui/styles";

// The add-a-marker toolbar. Each button doubles as the role's legend: its swatch is the court's own
// marker art, and pressing it drops a fresh marker of that role onto the court. The active mode
// decides which roles are offered. Its control look comes from the shared LEGEND_BUTTON/SWATCH_BASE.
// With the opponent half on, a side switch leads the row and decides which team a new marker joins.
// It is the only place a team is chosen: once a marker exists, the half it stands on is its team.
type MarkerPaletteProps = {
  mode: CourtMode;
  onAdd: (role: MarkerRole) => void;
  /** Present when the opponent half is on: the side a pressed role adds to. */
  side?: { value: Marker["side"]; onChange: (side: Marker["side"]) => void };
};

// Our side is the absent `side`, so this maps it to and from a toggle value.
const SIDE_ITEMS = [
  { value: "us", label: "Our team" },
  { value: "opponent", label: "Opponent" },
];

export function MarkerPalette({ mode, onAdd, side }: MarkerPaletteProps): JSX.Element {
  const opponent = side?.value === "opponent";

  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-2" role="group" aria-label="Add a marker">
      {side && (
        <ToggleGroup
          ariaLabel="Side for new markers"
          items={SIDE_ITEMS}
          value={opponent ? "opponent" : "us"}
          onValueChange={(value) => side.onChange(value === "opponent" ? "opponent" : undefined)}
        />
      )}
      {MODE_ROLES[mode].map((role) => {
        const style = ROLES[role];

        return (
          <button
            key={role}
            type="button"
            className={LEGEND_BUTTON}
            onClick={() => onAdd(role)}
            aria-label={`Add ${opponent && role !== "ball" ? "opponent " : ""}${style.name.toLowerCase()}`}
          >
            <span className={SWATCH_BASE} aria-hidden="true">
              {role === "ball" ? (
                <BallSwatch />
              ) : (
                <MarkerSwatch fill={style.fill} ring={style.ring} text={style.text} code={style.code} />
              )}
            </span>
            <span className="text-sm font-semibold">{style.name}</span>
          </button>
        );
      })}
    </div>
  );
}
