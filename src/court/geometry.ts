// The court's coordinate foundation: a resolution-independent space everything else inherits.
//
// Marker positions are stored as normalized coordinates in [0, 1] across the playing area
// (x: sideline to sideline, y: net to end line). Rendering maps them into the SVG `viewBox`,
// which surrounds the court with a free-zone margin so it has room to breathe. Nothing outside
// this module should know about pixels or SVG units.

/** Side length of the playing area in SVG units. The half-court is square (9 m x 9 m). */
export const COURT_SPAN = 1000;

/** Free-zone margin around the playing area, in SVG units. */
export const FREE_ZONE = 150;

/** Side length of the full square `viewBox`, playing area plus free zone on every side. */
export const VIEW_SIZE = COURT_SPAN + FREE_ZONE * 2;

/** Distance of the attack line from the net, as a fraction of the half-court depth (3 m of 9 m). */
export const ATTACK_LINE = 1 / 3;

export type NormalizedPoint = { x: number; y: number };

/** Clamp a value into the normalized range [0, 1]. */
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Map a single normalized coordinate (0–1 across the playing area) to an SVG coordinate. */
export function toSvg(normalized: number): number {
  return FREE_ZONE + normalized * COURT_SPAN;
}

/** Map a normalized point to its SVG position. */
export function toSvgPoint(point: NormalizedPoint): NormalizedPoint {
  return { x: toSvg(point.x), y: toSvg(point.y) };
}
