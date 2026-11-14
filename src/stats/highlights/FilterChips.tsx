import type { JSX } from "react";

import { Button } from "../../ui/Button";
import { Toggle } from "../../ui/Toggle";
import { FIELD_LABEL } from "../../ui/styles";
import { filterActions } from "../clips";
import type { FilterField, HighlightAction, Selection } from "../clips";

const LABELS: Record<FilterField, string> = {
  match: "Match",
  set: "Set",
  player: "Player",
  action: "Action",
  outcome: "Outcome",
  zone: "Zone",
};

/** The values of one highlight filter as toggles, each with how many actions picking it would add. */
export function FilterChips({
  field,
  actions,
  selection,
  onToggle,
  onClear,
}: {
  field: FilterField;
  actions: readonly HighlightAction[];
  selection: Selection;
  onToggle: (field: FilterField, value: string) => void;
  onClear: () => void;
}): JSX.Element {
  // Counts follow the other filters.
  const counts = new Map<string, number>();

  for (const a of filterActions([...actions], { ...selection, [field]: new Set() }))
    counts.set(a[field], (counts.get(a[field]) ?? 0) + 1);

  // Matches go by date, as their clips play; everything else by name.
  const dates = new Map(actions.map((a) => [a.match, a.date]));
  const values = [...new Set(actions.map((a) => a[field]))]
    .filter(Boolean)
    .sort(
      (a, b) =>
        (field === "match" ? (dates.get(a) ?? "").localeCompare(dates.get(b) ?? "") : 0) ||
        a.localeCompare(b, undefined, { numeric: true })
    );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <h3 className={FIELD_LABEL}>{LABELS[field]}</h3>
        {selection[field].size > 0 && (
          <Button variant="text" size="sm" onClick={onClear}>
            Clear
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {values.map((value) => {
          const selected = selection[field].has(value);

          return (
            <Toggle
              key={value}
              pressed={selected}
              onPressedChange={() => onToggle(field, value)}
              ariaLabel={`${LABELS[field]} ${value}`}
              disabled={!selected && !counts.get(value)}
            >
              {value} <span className="text-xs text-text-dim">{counts.get(value) ?? 0}</span>
            </Toggle>
          );
        })}
      </div>
    </div>
  );
}
