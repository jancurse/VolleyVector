import type { JSX } from "react";

import { toSvgPoint } from "./geometry";
import type { Arrow } from "./types";

// Derived movement arrows. Each arrow is a straight line capped with a triangular head, inset at both
// ends so it clears the source and target discs, and coloured (via currentColor) to its marker.

const START_GAP = 56; // clear the source disc, in SVG units
const END_GAP = 58; // clear the target disc
const HEAD_LEN = 26;
const HEAD_WIDTH = 12;

type Segment = { line: { x1: number; y1: number; x2: number; y2: number }; head: string };

// The drawable line + arrowhead for one move, or null when the two ends are too close to draw cleanly.
function segment(arrow: Arrow): Segment | null {
  const a = toSvgPoint(arrow.from);
  const b = toSvgPoint(arrow.to);
  const len = Math.hypot(b.x - a.x, b.y - a.y);

  if (len <= START_GAP + END_GAP + HEAD_LEN) return null;

  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const tip = { x: b.x - ux * END_GAP, y: b.y - uy * END_GAP };
  const base = { x: tip.x - ux * HEAD_LEN, y: tip.y - uy * HEAD_LEN };
  const nx = -uy;
  const ny = ux;

  return {
    line: { x1: a.x + ux * START_GAP, y1: a.y + uy * START_GAP, x2: base.x, y2: base.y },
    head: `M ${tip.x} ${tip.y} L ${base.x + nx * HEAD_WIDTH} ${base.y + ny * HEAD_WIDTH} L ${base.x - nx * HEAD_WIDTH} ${base.y - ny * HEAD_WIDTH} Z`,
  };
}

export function Arrows({ arrows }: { arrows: readonly Arrow[] }): JSX.Element {
  return (
    <g className="court-arrows" aria-hidden="true">
      {arrows.map((arrow, i) => {
        const seg = segment(arrow);

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
