import type { JSX } from "react";

import { DASH_CARD, MUTED } from "../../ui/styles";
import { ALL } from "./data";
import type { GradeCount, SkillSummary } from "./data";
import { byGrade } from "./format";
import { MetricCard } from "./MetricCard";
import { ORDER } from "./params";
import { TipBox } from "./TipBox";

/** Every action of the chosen set and player: attempts, metric, and outcomes. */
export function MetricCards({
  summary,
  grades,
  set,
  player,
}: {
  summary: readonly SkillSummary[];
  grades: readonly GradeCount[];
  set: string;
  player: string;
}): JSX.Element {
  const cards = ORDER.flatMap((action) => {
    const sum = summary.find((r) => r.set === set && r.player === player && r.skill === action);

    return sum
      ? [
          {
            action,
            sum,
            grades: grades
              .filter((r) => r.zone === ALL && r.set === set && r.player === player && r.skill === action)
              .sort(byGrade),
          },
        ]
      : [];
  });

  return (
    <section aria-label="Metrics" className={DASH_CARD}>
      <TipBox className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,var(--container-dash-metric)),1fr))] gap-x-7 gap-y-4">
        {(tip) =>
          cards.length ? (
            cards.map((c) => <MetricCard key={c.action} {...c} set={set} player={player} tip={tip} />)
          ) : (
            <p className={MUTED}>No touches.</p>
          )
        }
      </TipBox>
    </section>
  );
}
