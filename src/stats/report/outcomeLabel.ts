import { RESULTS } from "../codes";

// Outcome ids ("dig23", "block_kill") as the tracker names them ("Dig 2-3", "Blocked, kill"). An id means the
// same outcome whatever the skill, so one table covers every chart.
const LABELS = new Map(
  Object.values(RESULTS).flatMap((results) => results.map((r): [string, string] => [r.id, r.label]))
);

/** An outcome's name for a chart's legend or label: the tracker's name, with any detail after a colon kept. */
export function outcomeLabel(id: string): string {
  const [base, detail] = id.split(": ");
  const label = LABELS.get(base) ?? base;

  return detail ? `${label}: ${detail}` : label;
}
