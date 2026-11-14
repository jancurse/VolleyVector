import type { JSX } from "react";

import { cx, MUTED } from "../../ui/styles";
import { ALL } from "./data";
import type { RallyRow, SetInfo } from "./data";
import { MiniScore } from "./MiniScore";

/** Score progression: a chart per set, one per row in a narrow card, else two by two, on shared scales. */
export function ScoreLines({
  rallies,
  sets,
  set,
}: {
  rallies: readonly RallyRow[];
  sets: readonly SetInfo[];
  set: string;
}): JSX.Element {
  if (!rallies.length) return <p className={MUTED}>No rallies.</p>;

  const maxScore = Math.max(...rallies.map((r) => Math.max(r.scoreUs, r.scoreThem)));
  const maxRally = Math.max(...rallies.map((r) => r.rally));
  const shown = sets.filter((s) => (set === ALL || s.id === set) && rallies.some((r) => r.set === s.id));

  return (
    <div className={cx("grid grid-cols-1 gap-4", shown.length > 1 && "@lg:grid-cols-2")}>
      {shown.map((s) => (
        <MiniScore
          key={s.id}
          label={s.label}
          rows={rallies.filter((r) => r.set === s.id)}
          maxScore={maxScore}
          maxRally={maxRally}
          tall={set !== ALL}
        />
      ))}
    </div>
  );
}
