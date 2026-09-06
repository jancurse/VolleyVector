// The court's coordinate foundation: a resolution-independent space everything else inherits.
//
// Marker positions are stored as normalized coordinates in [0, 1] across our half of the playing
// area (x: sideline to sideline, y: net to end line); the opponent half, shown only when a board
// opts in, runs from -1 to 0. Rendering maps them into the SVG `viewBox`, which surrounds the court
// with a free-zone margin so it has room to breathe. Nothing outside this module should know about
// pixels or SVG units.

import type { MarkerRole } from "./roles";

/** Side length of the playing area in SVG units. The half-court is square (9 m x 9 m). */
export const COURT_SPAN = 1000;

/** Free-zone margin around the playing area, in SVG units. */
export const FREE_ZONE = 150;

/** Side length of the full square `viewBox`, playing area plus free zone on every side. */
export const VIEW_SIZE = COURT_SPAN + FREE_ZONE * 2;

/** Distance of the attack line from the net, as a fraction of the half-court depth (3 m of 9 m). */
export const ATTACK_LINE = 1 / 3;

/** How far past the playing area a marker may sit, in normalized units. The free zone is wider than
 *  this (see FREE_ZONE), so a marker placed at the limit — the ball over the net, a deep serve —
 *  stays clear of the viewBox edge and never clips. */
export const MARKER_REACH = 0.1;

export type NormalizedPoint = { x: number; y: number };

/** The `viewBox` window: our half alone, or both halves with the opponent's above the net. */
export function courtViewBox(opponentSide: boolean): string {
  return opponentSide ? `0 ${-COURT_SPAN} ${VIEW_SIZE} ${VIEW_SIZE + COURT_SPAN}` : `0 0 ${VIEW_SIZE} ${VIEW_SIZE}`;
}

/** The `viewBox`'s size in SVG units, for surfaces that need the court's aspect. */
export function viewExtent(opponentSide: boolean): { width: number; height: number } {
  return { width: VIEW_SIZE, height: opponentSide ? VIEW_SIZE + COURT_SPAN : VIEW_SIZE };
}

/** Clamp a value into the normalized range [0, 1]. */
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Clamp a point to the area a marker may occupy: the playing court plus its free-zone reach. With
 *  the opponent side on, that area reaches past the net to the far end line. */
export function clampToCourt(point: NormalizedPoint, opponentSide = false): NormalizedPoint {
  const min = -MARKER_REACH;
  const max = 1 + MARKER_REACH;

  return {
    x: Math.min(max, Math.max(min, point.x)),
    y: Math.min(max, Math.max(opponentSide ? -1 - MARKER_REACH : min, point.y)),
  };
}

/** Where one marker may go: the court's reach, plus a wall at the net holding a player to their own
 *  team's half, so a marker can never change teams by being moved across. The wall stands whether or
 *  not the opponent half is shown, so turning it on can never strand a player on the far side. The
 *  ball is exempt, since it is the one thing that crosses. */
export function clampMarker(
  point: NormalizedPoint,
  opponentSide: boolean,
  marker: { role: MarkerRole; side?: "opponent" }
): NormalizedPoint {
  const clamped = clampToCourt(point, opponentSide);

  if (marker.role === "ball") return clamped;

  return { ...clamped, y: marker.side === "opponent" ? Math.min(0, clamped.y) : Math.max(0, clamped.y) };
}

/** Fraction of a grid cell within which an axis snaps to the nearest gridline. About a third of the
 *  cell on each side pulls to a line, so the middle of every cell stays free for off-grid placement. */
const SNAP_FRACTION = 0.33;

/** Snap a point to the nearest line of a `divisions`×`divisions` grid over the playing area, per axis
 *  and only when within {@link SNAP_FRACTION} of a cell — a magnetic pull near lines that leaves the
 *  rest of each cell free. Snapped coordinates land in [0, 1]; an axis already past the court stays
 *  put, so a benched marker is never yanked onto the end line. */
export function snapToGrid(point: NormalizedPoint, divisions: number, opponentSide = false): NormalizedPoint {
  return { x: snapAxis(point.x, divisions, 0), y: snapAxis(point.y, divisions, opponentSide ? -1 : 0) };
}

function snapAxis(value: number, divisions: number, lo: number): number {
  // A value already off the court (a benched marker past the end line) never snaps onto the
  // boundary, however close a coarse grid puts the line: it would yank the marker onto the court.
  if (value < lo || value > 1) return value;

  const cell = 1 / divisions;
  const line = Math.max(lo, Math.min(1, Math.round(value / cell) * cell));

  return Math.abs(value - line) <= cell * SNAP_FRACTION ? line : value;
}

/** Map a single normalized coordinate (0–1 across the playing area) to an SVG coordinate. */
export function toSvg(normalized: number): number {
  return FREE_ZONE + normalized * COURT_SPAN;
}

/** Map a normalized point to its SVG position. */
export function toSvgPoint(point: NormalizedPoint): NormalizedPoint {
  return { x: toSvg(point.x), y: toSvg(point.y) };
}

/** Inverse of `toSvg`: map an SVG coordinate back to normalized (may land outside [0, 1]). */
export function fromSvg(svg: number): number {
  return (svg - FREE_ZONE) / COURT_SPAN;
}

/** Inverse of `toSvgPoint`: map an SVG point back to a normalized point. */
export function fromSvgPoint(point: NormalizedPoint): NormalizedPoint {
  return { x: fromSvg(point.x), y: fromSvg(point.y) };
}
