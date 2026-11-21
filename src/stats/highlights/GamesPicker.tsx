import type { JSX } from "react";

import { cx, FILTER_PICKER, FILTER_SUBROW } from "../../ui/styles";
import { Toggle } from "../../ui/Toggle";
import { fieldCounts, setKey } from "../clips";
import { games, shortSet, toggled } from "./picker";
import type { PickerProps } from "./picker";
import { PickRow } from "./PickRow";

/** The matches as rows, each with its sets under it: a row picks the whole match, a set only itself. */
export function GamesPicker({ actions, selection, onChange }: PickerProps): JSX.Element {
  const counts = fieldCounts(actions, selection, "set");

  return (
    <div className={cx(FILTER_PICKER.list, "gap-2")}>
      {games(actions).map(({ match, sets }) => {
        const keys = sets.map((s) => setKey(match, s));
        const picked = keys.filter((k) => selection.set.has(k));
        const all = picked.length === keys.length;

        return (
          <div key={match} className="flex flex-col gap-1">
            <PickRow
              pressed={all || (picked.length > 0 && "mixed")}
              ariaLabel={`Match ${match}`}
              count={keys.reduce((n, k) => n + (counts.get(k) ?? 0), 0)}
              onToggle={() => {
                const next = new Set(selection.set);

                for (const k of keys)
                  if (all) next.delete(k);
                  else next.add(k);

                onChange({ set: next });
              }}
            >
              {match}
            </PickRow>
            <div className={FILTER_SUBROW}>
              {sets.map((s, i) => (
                <Toggle
                  key={s}
                  pressed={selection.set.has(keys[i])}
                  onPressedChange={() => onChange({ set: toggled(selection.set, keys[i]) })}
                  ariaLabel={`${match} ${s}`}
                  disabled={!selection.set.has(keys[i]) && !counts.get(keys[i])}
                >
                  {shortSet(s)} <span className="text-xs font-medium text-text-dim">{counts.get(keys[i]) ?? 0}</span>
                </Toggle>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
