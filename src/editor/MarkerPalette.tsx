import type { JSX } from "react";

import type { CourtMode, MarkerRole } from "../court/roles";
import { MODE_ROLES, ROLES } from "../court/roles";

// The add-a-marker toolbar. Each button doubles as the role's legend: its swatch shows the colour
// and code, and pressing it drops a fresh marker of that role onto the court. The active mode
// decides which roles are offered.
type MarkerPaletteProps = {
  mode: CourtMode;
  onAdd: (role: MarkerRole) => void;
};

export function MarkerPalette({ mode, onAdd }: MarkerPaletteProps): JSX.Element {
  return (
    <div className="vc-palette" role="group" aria-label="Add a marker">
      {MODE_ROLES[mode].map((role) => {
        const style = ROLES[role];

        return (
          <button
            key={role}
            type="button"
            className="vc-palette-add"
            onClick={() => onAdd(role)}
            aria-label={`Add ${style.name.toLowerCase()}`}
          >
            <span
              className="vc-swatch"
              style={{ background: style.fill, borderColor: style.ring, color: style.text }}
              aria-hidden="true"
            >
              {style.code}
            </span>
            <span className="vc-palette-name">{style.name}</span>
          </button>
        );
      })}
    </div>
  );
}
