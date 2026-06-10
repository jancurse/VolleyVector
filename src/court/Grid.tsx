import type { JSX } from "react";

import { toSvg } from "./geometry";

// A faint reference grid over the playing area, an authoring aid for placing markers. `divisions` is
// the number of cells per axis; the half-court is 9 m square, so 3/9/27 align with the 1/3 attack line.
// Only interior lines are drawn — the outer ones coincide with the court boundary. Purely decorative,
// so it is hidden from assistive tech and never the read-only diagram.

export function CourtGrid({ divisions }: { divisions: number }): JSX.Element | null {
  if (divisions < 2) return null;

  const start = toSvg(0);
  const end = toSvg(1);
  const lines = Array.from({ length: divisions - 1 }, (_, i) => toSvg((i + 1) / divisions));

  return (
    <g className="court-grid" data-divisions={divisions} aria-hidden="true">
      {lines.map((p, i) => (
        <line key={`v${i}`} className="court-grid-line" x1={p} y1={start} x2={p} y2={end} />
      ))}
      {lines.map((p, i) => (
        <line key={`h${i}`} className="court-grid-line" x1={start} y1={p} x2={end} y2={p} />
      ))}
    </g>
  );
}
