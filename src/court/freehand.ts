import { toSvgPoint } from "./geometry";
import type { NormalizedPoint } from "./geometry";

// Freehand stroke geometry. A captured path is stored as a thin list of normalized points (simplified
// on commit to keep the board JSON small) and rendered as a constant-width stroked SVG path. Vertices
// smooth selectively: a gentle turn rounds through midpoints, a sharp turn stays a hard corner, so a
// drawn circle comes out smooth while a zigzag or triangle keeps its points.

// A vertex turning more than this (radians) is a deliberate corner and stays unrounded. A simplified
// hand-drawn circle turns ~20–30° per vertex; a zigzag or triangle turns 60° or more.
const CORNER_ANGLE = Math.PI / 3;

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

/** The angle (radians) the direction turns at `b`, arriving from `a` and leaving toward `c`. */
function turnAngle(a: NormalizedPoint, b: NormalizedPoint, c: NormalizedPoint): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = c.x - b.x;
  const wy = c.y - b.y;
  const lengths = Math.hypot(vx, vy) * Math.hypot(wx, wy);

  if (lengths === 0) return 0;

  return Math.acos(Math.min(1, Math.max(-1, (vx * wx + vy * wy) / lengths)));
}

/** The SVG path `d` for a freehand stroke, to be drawn with a constant-width stroke (never filled).
 *  Each gentle vertex becomes a quadratic curve through its outgoing midpoint; each sharp vertex stays
 *  a straight-line corner. */
export function freehandPath(points: readonly NormalizedPoint[]): string {
  const pts = points.map((p) => toSvgPoint(p));

  if (pts.length === 0) return "";

  const d = [`M ${pts[0].x} ${pts[0].y}`];

  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];

    if (turnAngle(pts[i - 1], p, pts[i + 1]) > CORNER_ANGLE) {
      d.push(`L ${p.x} ${p.y}`);
    } else {
      d.push(`Q ${p.x} ${p.y} ${(p.x + pts[i + 1].x) / 2} ${(p.y + pts[i + 1].y) / 2}`);
    }
  }

  if (pts.length > 1) d.push(`L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`);

  return d.join(" ");
}
