import type { JSX } from "react";

import type { ColorKey, CourtMode, MarkerRole } from "../court/roles";
import { COLOR_KEYS, MARKER_COLORS, MODE_ROLES, ROLES } from "../court/roles";
import type { Marker } from "../court/types";

// Edits the one selected marker: pick its role (within the active mode's family), recolour it (basic
// mode), rename its label, or remove it. Position is edited on the court (drag or arrow keys).
type MarkerInspectorProps = {
  marker: Marker;
  mode: CourtMode;
  onChangeRole: (role: MarkerRole) => void;
  onChangeColor: (color: ColorKey) => void;
  onChangeLabel: (label: string) => void;
  onDelete: () => void;
};

export function MarkerInspector({
  marker,
  mode,
  onChangeRole,
  onChangeColor,
  onChangeLabel,
  onDelete,
}: MarkerInspectorProps): JSX.Element {
  const fill = marker.color ? MARKER_COLORS[marker.color].fill : ROLES[marker.role].fill;

  return (
    <section className="vc-inspector" aria-label="Selected marker">
      <div className="vc-inspector-head">
        <span className="vc-panel-title">Marker</span>
        <button type="button" className="vc-text-button" onClick={onDelete}>
          Remove
        </button>
      </div>

      <div className="vc-field">
        <span className="vc-field-label">Role</span>
        <div className="vc-role-picker" role="group" aria-label="Role">
          {MODE_ROLES[mode].map((role) => {
            const style = ROLES[role];

            return (
              <button
                key={role}
                type="button"
                className={`vc-swatch vc-role-swatch${role === marker.role ? " vc-role-swatch--on" : ""}`}
                style={{ background: style.fill, borderColor: style.ring, color: style.text }}
                aria-label={style.name}
                aria-pressed={role === marker.role}
                onClick={() => onChangeRole(role)}
              >
                {style.code}
              </button>
            );
          })}
        </div>
      </div>

      {mode === "basic" && marker.role !== "ball" && (
        <div className="vc-field">
          <span className="vc-field-label">Colour</span>
          <div className="vc-role-picker" role="group" aria-label="Colour">
            {COLOR_KEYS.map((key) => {
              const color = MARKER_COLORS[key];

              return (
                <button
                  key={key}
                  type="button"
                  className={`vc-swatch vc-role-swatch${color.fill === fill ? " vc-role-swatch--on" : ""}`}
                  style={{ background: color.fill, borderColor: color.ring }}
                  aria-label={color.name}
                  aria-pressed={color.fill === fill}
                  onClick={() => onChangeColor(key)}
                />
              );
            })}
          </div>
        </div>
      )}

      {marker.role !== "ball" && (
        <label className="vc-field">
          <span className="vc-field-label">Label</span>
          <input
            className="vc-input"
            type="text"
            value={marker.label ?? ""}
            placeholder={ROLES[marker.role].code}
            maxLength={4}
            onChange={(event) => onChangeLabel(event.target.value)}
          />
        </label>
      )}
    </section>
  );
}
