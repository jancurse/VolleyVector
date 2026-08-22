import type { JSX } from "react";

import { BallSwatch } from "../court/BallArt";
import { MarkerSwatch } from "../court/MarkerSwatch";
import type { ColorKey, CourtMode, MarkerRole } from "../court/roles";
import { COLOR_KEYS, MARKER_COLORS, MODE_ROLES, ROLES } from "../court/roles";
import type { Marker } from "../court/types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { SwatchGroup } from "../ui/SwatchGroup";

// The single-line bar the editor reserves above the court. It holds the selected marker's controls,
// or the editor's prompt when nothing is selected, so the slot stays the same height either way and
// selecting a marker never shifts the court.
export const MARKER_BAR =
  "flex min-h-14 w-full flex-wrap items-center gap-3 rounded-xl border border-border bg-panel px-3 py-1.5";

// Edits the one selected marker as a single-line bar above the court: pick its role (within the active
// mode's family), recolour it (basic mode), rename its label, or remove it. Position is edited on the
// court (drag or arrow keys). A marker's team is fixed once it exists: it is set by the half it was
// added to, and the court's wall at the net keeps it there.
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
  const colorKey = COLOR_KEYS.find((key) => MARKER_COLORS[key].fill === fill) ?? "";

  return (
    <section className={MARKER_BAR} aria-label="Selected marker">
      <SwatchGroup
        ariaLabel="Role"
        value={marker.role}
        onValueChange={(role) => onChangeRole(role as MarkerRole)}
        items={MODE_ROLES[mode].map((role) => ({
          value: role,
          label: ROLES[role].name,
          art:
            role === "ball" ? (
              <BallSwatch />
            ) : (
              <MarkerSwatch
                fill={ROLES[role].fill}
                ring={ROLES[role].ring}
                text={ROLES[role].text}
                code={ROLES[role].code}
              />
            ),
        }))}
      />

      {mode === "basic" && marker.role !== "ball" && (
        <SwatchGroup
          ariaLabel="Colour"
          value={colorKey}
          onValueChange={(key) => onChangeColor(key as ColorKey)}
          items={COLOR_KEYS.map((key) => ({
            value: key,
            label: MARKER_COLORS[key].name,
            art: <MarkerSwatch fill={MARKER_COLORS[key].fill} ring={MARKER_COLORS[key].ring} />,
          }))}
        />
      )}

      {marker.role !== "ball" && (
        <div className="w-20">
          <Input
            type="text"
            aria-label="Label"
            className="text-center"
            value={marker.label ?? ""}
            placeholder={ROLES[marker.role].code}
            maxLength={4}
            onChange={(event) => onChangeLabel(event.target.value)}
          />
        </div>
      )}

      <Button variant="text" size="sm" className="ml-auto" onClick={onDelete}>
        Remove
      </Button>
    </section>
  );
}
