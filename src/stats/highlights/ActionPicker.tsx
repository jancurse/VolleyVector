import type { JSX } from "react";

import { Toggle } from "../../ui/Toggle";
import { cx, FILTER_PICKER, FILTER_SUBROW, POINT_DOT } from "../../ui/styles";
import { fieldCounts, outcomeKey } from "../clips";
import type { HighlightAction } from "../clips";
import { actionName, actionNames, toggled } from "./picker";
import type { PickerProps } from "./picker";
import { PickRow } from "./PickRow";

const POINT_ORDER: HighlightAction["point"][] = ["won", "", "lost"];
const POINT_NOTE: Record<HighlightAction["point"], string> = { won: "wins the point", lost: "loses the point", "": "" };

/**
 * The actions as rows. A picked action shows its own outcomes under it, the ones that win the point first and
 * the ones that lose it last; with none of them picked, the action keeps them all.
 */
export function ActionPicker({ actions, selection, onChange }: PickerProps): JSX.Element {
  const counts = fieldCounts(actions, selection, "action");
  const outcomeCounts = fieldCounts(actions, selection, "outcome");

  return (
    <div className={cx(FILTER_PICKER.list, "gap-0.5")}>
      {actionNames(actions).map((action) => {
        const pressed = selection.action.has(action);
        const outcomes = pressed
          ? [...new Map(actions.filter((a) => a.action === action && a.outcome).map((a) => [a.outcome, a.point]))].sort(
              ([a, p], [b, q]) => POINT_ORDER.indexOf(p) - POINT_ORDER.indexOf(q) || a.localeCompare(b)
            )
          : [];

        return (
          <div key={action} className="flex flex-col">
            <PickRow
              pressed={pressed}
              ariaLabel={`Action ${actionName(action)}`}
              count={counts.get(action) ?? 0}
              onToggle={() =>
                onChange({
                  action: toggled(selection.action, action),
                  // Its outcomes go with it.
                  outcome: new Set([...selection.outcome].filter((key) => !key.startsWith(`${action}|`))),
                })
              }
            >
              {actionName(action)}
            </PickRow>
            {outcomes.length > 0 && (
              <div className={cx(FILTER_SUBROW, "pt-1 pb-2")}>
                {outcomes.map(([outcome, point]) => {
                  const key = outcomeKey(action, outcome);

                  return (
                    <Toggle
                      key={outcome}
                      pressed={selection.outcome.has(key)}
                      onPressedChange={() => onChange({ outcome: toggled(selection.outcome, key) })}
                      ariaLabel={[actionName(action), outcome, POINT_NOTE[point]].filter(Boolean).join(", ")}
                      disabled={!selection.outcome.has(key) && !outcomeCounts.get(key)}
                    >
                      <span className={POINT_DOT[point]} aria-hidden="true" />
                      {outcome}
                      <span className="text-xs font-medium text-text-dim">{outcomeCounts.get(key) ?? 0}</span>
                    </Toggle>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
