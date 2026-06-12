import type { JSX } from "react";

import { BallSwatch } from "../court/BallArt";
import { MarkerSwatch } from "../court/MarkerSwatch";
import type { ColorKey, CourtMode, MarkerRole } from "../court/roles";
import { COLOR_KEYS, MARKER_COLORS, MODE_ROLES, ROLES } from "../court/roles";
import type { Marker } from "../court/types";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { SwatchGroup } from "../ui/SwatchGroup";
import { FIELD_LABEL, PANEL, PANEL_TITLE } from "../ui/styles";

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
  const colorKey = COLOR_KEYS.find((key) => MARKER_COLORS[key].fill === fill) ?? "";

  return (
    <section className={PANEL} aria-label="Selected marker">
      <div className="flex items-center justify-between">
        <span className={PANEL_TITLE}>Marker</span>
        <Button variant="text" size="sm" onClick={onDelete}>
          Remove
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <span className={FIELD_LABEL}>Role</span>
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
      </div>

      {mode === "basic" && marker.role !== "ball" && (
        <div className="flex flex-col gap-2">
          <span className={FIELD_LABEL}>Colour</span>
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
        </div>
      )}

      {marker.role !== "ball" && (
        <Field label="Label">
          <Input
            type="text"
            value={marker.label ?? ""}
            placeholder={ROLES[marker.role].code}
            maxLength={4}
            onChange={(event) => onChangeLabel(event.target.value)}
          />
        </Field>
      )}
    </section>
  );
}
