import type { JSX } from "react";

import { FILTER_PICKER } from "../../ui/styles";
import { fieldCounts } from "../clips";
import { playerNames, toggled } from "./picker";
import type { PickerProps } from "./picker";
import { PickRow } from "./PickRow";

/** The players in two columns, the opponent last. */
export function PlayersPicker({ actions, selection, onChange }: PickerProps): JSX.Element {
  const counts = fieldCounts(actions, selection, "player");

  return (
    <div className={FILTER_PICKER.players}>
      {playerNames(actions).map((name) => (
        <PickRow
          key={name}
          pressed={selection.player.has(name)}
          ariaLabel={`Player ${name}`}
          count={counts.get(name) ?? 0}
          onToggle={() => onChange({ player: toggled(selection.player, name) })}
        >
          {name}
        </PickRow>
      ))}
    </div>
  );
}
