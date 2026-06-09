import { getStroke } from "perfect-freehand";

import { toSvgPoint } from "./geometry";
import type { NormalizedPoint } from "./geometry";

// Freehand stroke geometry, the one place perfect-freehand is used. A captured path is stored as a
// thin list of normalized points (simplified on commit to keep the board JSON small) and turned into a
// filled SVG outline only at render time, so it themes and scales with the rest of the court.

// The brush diameter relative to the chosen stroke width, so a freehand line reads as a pen of about
// the same weight as a straight line at the same width setting.
const SIZE_SCALE = 2;

const STROKE_OPTIONS = { thinning: 0.55, smoothing: 0.6, streamline: 0.5, simulatePressure: true, last: true };

/** Perpendicular distance from `p` to the line through `a`–`b` (used by the RDP simplifier). */
function pointLineDistance(p: NormalizedPoint, a: NormalizedPoint, b: NormalizedPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);

  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

// Ramer–Douglas–Peucker: drop points that sit within `epsilon` of the line their neighbours span, so a
// hand-drawn stroke keeps its shape with a fraction of the captured samples.
function rdp(points: readonly NormalizedPoint[], epsilon: number): NormalizedPoint[] {
  if (points.length < 3) return [...points];

  let maxDist = 0;
  let index = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const dist = pointLineDistance(points[i], points[0], points[points.length - 1]);

    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist <= epsilon) return [points[0], points[points.length - 1]];

  const left = rdp(points.slice(0, index + 1), epsilon);
  const right = rdp(points.slice(index), epsilon);

  return [...left.slice(0, -1), ...right];
}

/** Simplify a captured freehand stroke before storing it, trimming samples while keeping its shape. */
export function simplifyStroke(points: readonly NormalizedPoint[]): NormalizedPoint[] {
  return rdp(points, 0.004);
}

/** Turn the perfect-freehand outline into a filled SVG path `d`. */
function svgPathFromStroke(stroke: number[][]): string {
  if (stroke.length === 0) return "";

  const d = stroke.reduce<(string | number)[]>(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];

      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);

      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );

  d.push("Z");

  return d.join(" ");
}

/** The filled SVG outline `d` for a freehand stroke of `width`, from its normalized points. */
export function freehandPath(points: readonly NormalizedPoint[], width: number): string {
  const svgPoints = points.map((p) => {
    const { x, y } = toSvgPoint(p);

    return [x, y];
  });

  return svgPathFromStroke(getStroke(svgPoints, { ...STROKE_OPTIONS, size: width * SIZE_SCALE }));
}
