import type { JSX } from "react";

import { cx, DASH_ROWS, MUTED, OUTCOME_BAR, OUTCOME_SEGMENT, THEM_TEXT, US_TEXT } from "../../ui/styles";
import { ALL } from "./data";
import type { Action, GradeCount, SkillSummary } from "./data";
import { FitLabel } from "./FitLabel";
import { byGrade, pct, score, signed } from "./format";
import { gradeClass, gradeKey } from "./grades";
import { Legend } from "./Legend";
import { TipBox } from "./TipBox";

const HEAD = "text-text-dim";

/** One action, player by player: their outcomes as bars to scale, their net, and the action's metric. */
export function PlayerDetail({
  summary,
  grades: all,
  set,
  action,
}: {
  summary: readonly SkillSummary[];
  grades: readonly GradeCount[];
  set: string;
  action: Action;
}): JSX.Element {
  const rows = summary
    .filter((r) => r.set === set && r.skill === action && r.player !== ALL)
    .sort((a, b) => b.net - a.net || b.attempts - a.attempts);

  if (!rows.length) return <p className={MUTED}>No touches.</p>;

  const grades = all.filter((g) => g.zone === ALL && g.set === set && g.skill === action);
  const order = grades.filter((g) => g.player === ALL).sort(byGrade);
  const max = Math.max(...rows.map((r) => r.attempts));

  return (
    <TipBox className={DASH_ROWS}>
      {(tip) => (
        <>
          <Legend className="col-span-full" items={gradeKey(order)} />
          <div className={HEAD}>Player</div>
          <div className={HEAD}>Outcomes</div>
          <div className={cx(HEAD, "text-right")}>Net</div>
          <div className={cx(HEAD, "text-right")}>{rows[0].def?.name ?? ""}</div>
          {rows.map((r) => (
            <div key={r.player} className="contents">
              <div>{r.player}</div>
              <div>
                <div className={OUTCOME_BAR} style={{ width: `${(100 * r.attempts) / max}%` }}>
                  {order.map((g, i) => {
                    const n = grades.find((x) => x.player === r.player && x.grade === g.grade)?.n ?? 0;

                    return n ? (
                      <FitLabel
                        key={g.grade}
                        labels={[String(n)]}
                        className={cx(OUTCOME_SEGMENT, gradeClass(order, i))}
                        style={{ flex: `${n} 0 0` }}
                        {...tip({
                          lines: [`${r.player}: ${g.grade}`, `${n} of ${r.attempts} (${pct(n / r.attempts)})`],
                          clips: { set, player: r.player, action, grade: g.grade },
                        })}
                      />
                    ) : null;
                  })}
                </div>
              </div>
              <div className={cx("text-right", r.net > 0 ? US_TEXT : r.net < 0 ? THEM_TEXT : "")}>{signed(r.net)}</div>
              <div className="text-right">{score(r)}</div>
            </div>
          ))}
        </>
      )}
    </TipBox>
  );
}
