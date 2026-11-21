import type { JSX } from "react";

import { CHOICE_TONE, cx, FILTER_PICKER, FILTER_ZONE, NET_CAPTION, NET_LINE, NET_LINE_BELOW } from "../../ui/styles";
import { fieldCounts } from "../clips";
import { ZONE_GRID, ZONE_GRID_THEIRS, zoneSide } from "../codes";
import { actionSkill, toggled, zoneName } from "./picker";
import type { PickerProps } from "./picker";

/**
 * The zones as a court against the net, as the tracker draws it. With the actions picked all landing on the
 * opponent's court (a serve, an attack) it draws theirs, and with one skill picked it says what its zone means.
 */
export function ZonePicker({ actions, selection, onChange }: PickerProps): JSX.Element {
  const counts = fieldCounts(actions, selection, "zone");
  const skills = [...new Set([...selection.action].map((a) => actionSkill(a)))];
  const theirs = skills.length > 0 && skills.every((s) => s && zoneSide(s.id) === "theirs");
  const net = <div className={NET_CAPTION}>net</div>;
  const cell = (z: string) => (
    <button
      key={z}
      type="button"
      aria-pressed={selection.zone.has(z)}
      aria-label={`Zone ${zoneName(z)}`}
      disabled={!selection.zone.has(z) && !counts.get(z)}
      onClick={() => onChange({ zone: toggled(selection.zone, z) })}
      className={cx(
        FILTER_ZONE,
        z === "0" && "h-8 flex-row gap-1.5",
        CHOICE_TONE[selection.zone.has(z) ? "selected" : "idle"]
      )}
    >
      {zoneName(z)}
      <span className="text-2xs font-medium opacity-70 tabular-nums">{counts.get(z) ?? 0}</span>
    </button>
  );

  return (
    <div className={FILTER_PICKER.court}>
      {theirs ? <p className="m-0 text-center text-xs text-text-dim">Their court, seen from ours</p> : net}
      <div className={cx("grid grid-cols-3 gap-1.5", theirs ? NET_LINE_BELOW : NET_LINE)}>
        {(theirs ? ZONE_GRID_THEIRS : ZONE_GRID)
          .flatMap((row) => row.filter((z): z is string => !!z && z !== "0"))
          .map(cell)}
      </div>
      {theirs && net}
      {cell("0")}
      <p className="m-0 pt-1 text-center text-xs text-text-dim">
        {skills.length === 1 && skills[0] ? skills[0].zoneHint : "A zone means what its action recorded"}
      </p>
    </div>
  );
}
