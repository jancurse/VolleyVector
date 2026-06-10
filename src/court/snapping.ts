import { ATTACK_LINE } from "./geometry";
import type { NormalizedPoint } from "./geometry";
import { snapToGrid } from "./geometry";

// Magnetic snapping for an annotation point being drawn or reshaped. Targets, strongest first: a
// marker centre on the active step (2D), the court's feature lines per axis (sidelines, centre line,
// net, attack line, end line), then the authoring grid when it is on. `target` reports where the
// point locked on, so the court can show a snap indicator; a grid-only snap reports none — the grid
// itself is the indicator.

/** How close (normalized) a point must be to a target before it snaps. */
const SNAP_RADIUS = 0.02;

const SNAP_X = [0, 0.5, 1];
const SNAP_Y = [0, ATTACK_LINE, 1];

export type SnapResult = { point: NormalizedPoint; target: NormalizedPoint | null };

function nearest(value: number, candidates: readonly number[]): number | null {
  let best: number | null = null;

  for (const candidate of candidates) {
    if (Math.abs(value - candidate) > SNAP_RADIUS) continue;
    if (best === null || Math.abs(value - candidate) < Math.abs(value - best)) best = candidate;
  }

  return best;
}

/** Snap `point` to the nearest marker centre, feature line, or gridline (`grid` divisions, 0 = off). */
export function snapAnnotationPoint(
  point: NormalizedPoint,
  markers: readonly NormalizedPoint[],
  grid: number
): SnapResult {
  let marker: NormalizedPoint | null = null;

  for (const m of markers) {
    const distance = Math.hypot(point.x - m.x, point.y - m.y);

    if (distance <= SNAP_RADIUS && (!marker || distance < Math.hypot(point.x - marker.x, point.y - marker.y)))
      marker = m;
  }

  if (marker) return { point: marker, target: marker };

  const x = nearest(point.x, SNAP_X);
  const y = nearest(point.y, SNAP_Y);

  if (x !== null || y !== null) {
    const gridded = grid > 0 ? snapToGrid(point, grid) : point;
    const snapped = { x: x ?? gridded.x, y: y ?? gridded.y };

    return { point: snapped, target: snapped };
  }

  return { point: grid > 0 ? snapToGrid(point, grid) : point, target: null };
}
