import type { JSX } from "react";

import { cx, DASH_FIGURE, OUTCOME_BAR, OUTCOME_SEGMENT } from "../../ui/styles";
import { actionLabel } from "./data";
import type { Action, GradeCount, SkillSummary } from "./data";
import { FitLabel } from "./FitLabel";
import { pct, score } from "./format";
import { gradeClass } from "./grades";
import { NOUN } from "./params";
import type { Tip } from "./tip";

/** One action's attempts, its metric, and its outcomes as a stacked bar; each part opens its clips. */
export function MetricCard({
  action,
  sum,
  grades,
  set,
  player,
  tip,
}: {
  action: Action;
  sum: SkillSummary;
  grades: readonly GradeCount[];
  set: string;
  player: string;
  tip: Tip;
}): JSX.Element {
  const total = sum.attempts;
  const noun = NOUN[action] ?? "";

  return (
    <div className="flex min-w-0 flex-col gap-1 print:break-inside-avoid">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="m-0 text-sm font-semibold">
          <span
            className="cursor-pointer"
            {...tip({ lines: [actionLabel(action), `${total} ${noun}`], clips: { set, player, action } })}
          >
            {actionLabel(action)}
          </span>
          <span className="ml-1 text-xs font-normal text-text-dim">
            {total} {total === 1 ? noun.replace(/s$/, "") : noun}
          </span>
        </h4>
        {sum.def && (
          <div className="flex items-baseline gap-1 whitespace-nowrap">
            <b className={DASH_FIGURE}>{score(sum)}</b>
            <span
              className="cursor-pointer text-xs text-text-dim underline decoration-dotted"
              {...tip({ lines: [sum.def.name, sum.def.formula] })}
            >
              {sum.def.name}
            </span>
          </div>
        )}
      </div>
      <div className={OUTCOME_BAR}>
        {grades.map((g, i) => (
          <FitLabel
            key={g.grade}
            labels={[`${g.grade} ${g.n}`, String(g.n)]}
            className={cx(OUTCOME_SEGMENT, gradeClass(grades, i))}
            style={{ flex: `${g.n} 0 0` }}
            {...tip({
              lines: [`${actionLabel(action)}: ${g.grade}`, `${g.n} of ${total} (${pct(g.n / total)})`],
              clips: { set, player, action, grade: g.grade },
            })}
          />
        ))}
      </div>
    </div>
  );
}
