import type { JSX } from "react";

import { toSvg } from "./geometry";

// A faint reference grid over the playing area, an authoring aid for placing markers. `divisions` is
// the number of cells per axis; the half-court is 9 m square, so 3/9/27 align with the 1/3 attack line.
// Only interior lines are drawn — the outer ones coincide with the court boundary. Purely decorative,
// so it is hidden from assistive tech and never the read-only diagram.

export function CourtGrid({
  divisions,
  opponentSide = false,
}: {
  divisions: number;
  opponentSide?: boolean;
}): JSX.Element | null {
  if (divisions < 2) return null;

  const start = toSvg(0);
  const end = toSvg(1);
  const top = toSvg(opponentSide ? -1 : 0);
  const cells = Array.from({ length: divisions - 1 }, (_, i) => (i + 1) / divisions);
  const rows = opponentSide ? [...cells, ...cells.map((c) => -c)] : cells;

  return (
    <g className="court-grid" data-divisions={divisions} aria-hidden="true">
      {cells.map((c, i) => (
        <line key={`v${i}`} className="court-grid-line" x1={toSvg(c)} y1={top} x2={toSvg(c)} y2={end} />
      ))}
      {rows.map((c, i) => (
        <line key={`h${i}`} className="court-grid-line" x1={start} y1={toSvg(c)} x2={end} y2={toSvg(c)} />
      ))}
    </g>
  );
}
