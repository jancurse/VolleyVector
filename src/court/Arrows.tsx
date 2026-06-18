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

type SvgPoint = { x: number; y: number };

/** The arrowhead path with its tip at `tip`, pointing along the unit direction (`ux`, `uy`). */
function headPath(tip: SvgPoint, ux: number, uy: number): string {
  const base = { x: tip.x - ux * HEAD_LEN, y: tip.y - uy * HEAD_LEN };
  const nx = -uy;
  const ny = ux;

  return `M ${tip.x} ${tip.y} L ${base.x + nx * HEAD_WIDTH} ${base.y + ny * HEAD_WIDTH} L ${base.x - nx * HEAD_WIDTH} ${base.y - ny * HEAD_WIDTH} Z`;
}

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

  return {
    line: { x1: a.x + ux * startGap, y1: a.y + uy * startGap, x2: tip.x - ux * HEAD_LEN, y2: tip.y - uy * HEAD_LEN },
    head: headPath(tip, ux, uy),
  };
}

export type CurvedArrowSegment = { path: string; head: string };

/** The drawn curve + arrowhead of an arrow bent through `via` — the point the quadratic Bézier passes
 *  at its midpoint — or null when the ends are too close to draw cleanly. The path stops short of the
 *  head's base (so the round cap never pokes past the tip) and the head aligns to the end tangent. */
export function curvedArrowSegment(
  from: NormalizedPoint,
  to: NormalizedPoint,
  via: NormalizedPoint
): CurvedArrowSegment | null {
  const a = toSvgPoint(from);
  const b = toSvgPoint(to);
  const v = toSvgPoint(via);
  const chord = Math.hypot(b.x - a.x, b.y - a.y);

  if (chord <= HEAD_LEN) return null;

  // The control point that makes the quadratic pass through `via` at t = 0.5. The end tangent runs
  // from the control to the tip (falling back to the chord when the control degenerates onto it).
  const c = { x: 2 * v.x - (a.x + b.x) / 2, y: 2 * v.y - (a.y + b.y) / 2 };
  const tangent = Math.hypot(b.x - c.x, b.y - c.y);
  const ux = tangent > 0 ? (b.x - c.x) / tangent : (b.x - a.x) / chord;
  const uy = tangent > 0 ? (b.y - c.y) / tangent : (b.y - a.y) / chord;

  // De Casteljau split: keep the curve up to t, leaving the last ~HEAD_LEN of (approximate) arc to
  // the head. The length estimate averages the chord and the control polygon.
  const length = (Math.hypot(c.x - a.x, c.y - a.y) + tangent + chord) / 2;
  const t = Math.max(0.5, 1 - HEAD_LEN / length);
  const c1 = { x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t };
  const m = { x: c.x + (b.x - c.x) * t, y: c.y + (b.y - c.y) * t };
  const end = { x: c1.x + (m.x - c1.x) * t, y: c1.y + (m.y - c1.y) * t };

  return { path: `M ${a.x} ${a.y} Q ${c1.x} ${c1.y} ${end.x} ${end.y}`, head: headPath(b, ux, uy) };
}

export function Arrows({ arrows }: { arrows: readonly Arrow[] }): JSX.Element {
  return (
    <g className="court-arrows" aria-hidden="true">
      {arrows.map((arrow, i) => {
        const seg = arrowSegment(arrow.from, arrow.to);

        if (!seg) return null;

        return (
          <g key={i} className="court-arrow" style={{ color: arrow.color }}>
            <line
              className={`court-arrow-line${arrow.dashed ? " court-arrow-line--dashed" : ""}`}
              x1={seg.line.x1}
              y1={seg.line.y1}
              x2={seg.line.x2}
              y2={seg.line.y2}
            />
            <path className="court-arrow-head" d={seg.head} />
          </g>
        );
      })}
    </g>
  );
}
