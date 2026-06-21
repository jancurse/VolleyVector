// The single geometry source for the brand mark: the board cropped to a court (boundary + attack line)
// with the ball breaking the top-right corner. Every surface derives from here — the live in-app mark
// (BrandMark.tsx) and the generated static SVGs (scripts/generate-brand-assets.ts) — so changing one
// constant rescales the favicon, the installed-app tile, the link-preview card, and the in-app mark at
// once, with no per-file editing. See docs/brand.md.

// Canonical proportions, each a ratio of the court side.
export const COURT_STROKE = 0.1; // court boundary stroke
export const ATTACK_STROKE = 0.085; // attack-line stroke
export const ATTACK_FROM_TOP = 1 / 3; // attack line, down from the court top
export const COURT_RADIUS = 0.2; // court corner radius
export const BALL_RADIUS = 0.165; // ball, centred on the top-right court corner, drawn over

// The maskable safe zone an OS guarantees: a centred circle of this radius (fraction of the icon side).
export const MASK_SAFE_RADIUS = 0.4;

// The mark's fixed palette: a warm amber accent and two neutrals. The retired blue (#2f6fe0) and brighter
// amber (#FFC61E) live nowhere in the icons; blue survives only as the in-app action accent.
export const BRAND_COLORS = {
  ball: "#e8973a", // the one constant accent, on every surface
  charcoal: "#22201c", // court under light browser chrome, and a baked tile's field
  offWhite: "#f3efe6", // court under dark browser chrome, and the court on a baked tile
} as const;

export type BrandMarkGeometry = {
  court: { x: number; y: number; size: number; radius: number; strokeWidth: number };
  attackLine: { x1: number; y1: number; x2: number; y2: number; strokeWidth: number };
  ball: { cx: number; cy: number; radius: number };
};

// Lay the mark out in a square `frame`. The footprint is the court plus the ball breaking past the
// top-right corner and half the boundary stroke spilling past the other edges, so it runs wider and
// taller than the court itself. Edge fit (the default) fills the frame so the mark touches all four
// edges, for a surface the browser never crops. Masked fit centres the mark and sizes it so its farthest
// point — the ball's outer edge — lands on the maskable safe-zone circle, the only margin a masked
// surface guarantees.
export function brandMarkGeometry(frame: number, { masked = false }: { masked?: boolean } = {}): BrandMarkGeometry {
  const footprint = 1 + BALL_RADIUS + COURT_STROKE / 2; // in court-side units
  const ballCenter = { x: COURT_STROKE / 2 + 1, y: BALL_RADIUS }; // top-right corner, in court-side units
  const farthest = Math.hypot(ballCenter.x - footprint / 2, ballCenter.y - footprint / 2) + BALL_RADIUS;

  const size = masked ? (MASK_SAFE_RADIUS * frame) / farthest : frame / footprint;
  const margin = (frame - footprint * size) / 2; // zero for an edge fit
  const x = margin + (COURT_STROKE / 2) * size;
  const y = margin + BALL_RADIUS * size;
  const attackY = y + ATTACK_FROM_TOP * size;

  return {
    court: { x, y, size, radius: COURT_RADIUS * size, strokeWidth: COURT_STROKE * size },
    attackLine: { x1: x, y1: attackY, x2: x + size, y2: attackY, strokeWidth: ATTACK_STROKE * size },
    ball: { cx: x + size, cy: y, radius: BALL_RADIUS * size },
  };
}
