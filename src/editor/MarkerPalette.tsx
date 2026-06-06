import type { JSX } from "react";

import type { CourtMode, MarkerRole } from "../court/roles";
import { MODE_ROLES, ROLES } from "../court/roles";
import { LEGEND_BUTTON, SWATCH_BASE } from "../ui/styles";

// The add-a-marker toolbar. Each button doubles as the role's legend: its swatch shows the colour
// and code, and pressing it drops a fresh marker of that role onto the court. The active mode
// decides which roles are offered. Its control look comes from the shared LEGEND_BUTTON/SWATCH_BASE.
type MarkerPaletteProps = {
  mode: CourtMode;
  onAdd: (role: MarkerRole) => void;
};

export function MarkerPalette({ mode, onAdd }: MarkerPaletteProps): JSX.Element {
  return (
    <div
      className="flex w-[min(74vh,560px)] max-w-full flex-wrap justify-center gap-2"
      role="group"
      aria-label="Add a marker"
    >
      {MODE_ROLES[mode].map((role) => {
        const style = ROLES[role];

        return (
          <button
            key={role}
            type="button"
            className={LEGEND_BUTTON}
            onClick={() => onAdd(role)}
            aria-label={`Add ${style.name.toLowerCase()}`}
          >
            <span
              className={SWATCH_BASE}
              style={{ background: style.fill, borderColor: style.ring, color: style.text }}
              aria-hidden="true"
            >
              {style.code}
            </span>
            <span className="text-sm font-semibold">{style.name}</span>
          </button>
        );
      })}
    </div>
  );
}
