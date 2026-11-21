import type { JSX } from "react";

import { Button } from "../../ui/Button";
import { ToggleGroup } from "../../ui/ToggleGroup";
import { emptySelection, FILTER_FIELDS } from "../clips";
import { ActionPicker } from "./ActionPicker";
import { FilterControl } from "./FilterControl";
import { GamesPicker } from "./GamesPicker";
import { pickedActions, pickedGames, zoneName } from "./picker";
import type { PickerProps } from "./picker";
import { PlayersPicker } from "./PlayersPicker";
import { ZonePicker } from "./ZonePicker";

/**
 * The highlights' filters as one row: games, players, action, and zone each open a picker and show what is
 * picked, and the point switch narrows to the actions that won or lost one.
 */
type FilterBarProps = PickerProps & {
  /** Whether the first picker, the games, is open: the filters' shortcut opens it. */
  gamesOpen: boolean;
  onGamesOpen: (open: boolean) => void;
};

export function FilterBar({ gamesOpen, onGamesOpen, ...props }: FilterBarProps): JSX.Element {
  const { actions, selection, onChange } = props;

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" role="group" aria-label="Filters">
      <FilterControl
        label="Games"
        picked={pickedGames(actions, selection.set)}
        onClear={() => onChange({ set: new Set() })}
        open={gamesOpen}
        onOpenChange={onGamesOpen}
      >
        <GamesPicker {...props} />
      </FilterControl>
      <FilterControl label="Players" picked={[...selection.player]} onClear={() => onChange({ player: new Set() })}>
        <PlayersPicker {...props} />
      </FilterControl>
      <FilterControl
        label="Action"
        picked={pickedActions(selection)}
        onClear={() => onChange({ action: new Set(), outcome: new Set() })}
      >
        <ActionPicker {...props} />
      </FilterControl>
      <FilterControl
        label="Zone"
        picked={[...selection.zone].sort().map(zoneName)}
        onClear={() => onChange({ zone: new Set() })}
      >
        <ZonePicker {...props} />
      </FilterControl>
      <span className="flex items-center gap-1.5 pl-1 text-sm font-semibold text-text-dim">
        Point
        <ToggleGroup
          ariaLabel="Point"
          value={[...selection.point][0] ?? "any"}
          onValueChange={(v) => onChange({ point: new Set(v === "any" ? [] : [v]) })}
          items={[
            { value: "any", label: "Any" },
            { value: "won", label: "Won" },
            { value: "lost", label: "Lost" },
          ]}
        />
      </span>
      {FILTER_FIELDS.some((field) => selection[field].size > 0) && (
        <Button variant="text" size="sm" onClick={() => onChange(emptySelection())}>
          Clear all
        </Button>
      )}
    </div>
  );
}
