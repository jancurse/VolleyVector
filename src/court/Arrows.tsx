import type { JSX } from "react";

import type { NormalizedPoint } from "./geometry";
import { toSvgPoint } from "./geometry";
import type { Arrow } from "./types";

// Movement arrows. Each is a straight line capped with a triangular head, inset at both ends so it
// clears the source and target discs, and coloured (via currentColor) to its marker. The geometry is
// shared with manual arrow annotations (with no insets), so both kinds wear the same arrowhead.

const START_GAP = 50; // clear the source disc, in SVG units
const END_GAP = 52; // clear the target disc
const HEAD_LEN = 26;
const HEAD_WIDTH = 12;

export type ArrowSegment = { line: { x1: number; y1: number; x2: number; y2: number }; head: string };

/** The drawable line + arrowhead between two normalized points, inset by the given gaps, or null when
 *  the two ends are too close to draw cleanly. Auto arrows inset to clear the marker discs; a manual
 *  arrow passes 0/0 to span exactly what was drawn while keeping the identical head. */
export function arrowSegment(
  from: NormalizedPoint,
  to: NormalizedPoint,
  startGap = START_GAP,
  endGap = END_GAP
): ArrowSegment | null {
  const a = toSvgPoint(from);
  const b = toSvgPoint(to);
  const len = Math.hypot(b.x - a.x, b.y - a.y);

  if (len <= startGap + endGap + HEAD_LEN) return null;

  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const tip = { x: b.x - ux * endGap, y: b.y - uy * endGap };
  const base = { x: tip.x - ux * HEAD_LEN, y: tip.y - uy * HEAD_LEN };
  const nx = -uy;
  const ny = ux;

  return {
    line: { x1: a.x + ux * startGap, y1: a.y + uy * startGap, x2: base.x, y2: base.y },
    head: `M ${tip.x} ${tip.y} L ${base.x + nx * HEAD_WIDTH} ${base.y + ny * HEAD_WIDTH} L ${base.x - nx * HEAD_WIDTH} ${base.y - ny * HEAD_WIDTH} Z`,
  };
}

export function Arrows({ arrows }: { arrows: readonly Arrow[] }): JSX.Element {
  return (
    <g className="court-arrows" aria-hidden="true">
      {arrows.map((arrow, i) => {
        const seg = arrowSegment(arrow.from, arrow.to);

        if (!seg) return null;

        return (
          <g key={i} className="court-arrow" style={{ color: arrow.color }}>
            <line className="court-arrow-line" x1={seg.line.x1} y1={seg.line.y1} x2={seg.line.x2} y2={seg.line.y2} />
            <path className="court-arrow-head" d={seg.head} />
          </g>
        );
      })}
    </g>
  );
}
