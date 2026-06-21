import type { JSX } from "react";

import { BRAND_COLORS, brandMarkGeometry } from "./brandMarkGeometry";

// The app's brand mark: the board cropped to a court (boundary + attack line) with the ball breaking the
// top-right corner, like a serve clearing the net. The single source for the in-product mark; the static
// favicon and icon SVGs are generated from the same geometry (see brandMarkGeometry.ts, docs/brand.md).
//
// Pure line plus a solid ball. Monochrome and theme-aware: the court draws in the current text colour, so
// the mark sits quietly in the sidebar and flips with light/dark on its own. The amber ball is the one
// constant accent. Laid out edge-to-edge, the same footprint as the favicon.
const FRAME = 100;
const mark = brandMarkGeometry(FRAME);

export function BrandMark({ size = 22 }: { size?: number }): JSX.Element {
  return (
    <svg viewBox={`0 0 ${FRAME} ${FRAME}`} width={size} height={size} aria-hidden="true" className="flex-none">
      <rect
        x={mark.court.x}
        y={mark.court.y}
        width={mark.court.size}
        height={mark.court.size}
        rx={mark.court.radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={mark.court.strokeWidth}
      />
      <line
        x1={mark.attackLine.x1}
        y1={mark.attackLine.y1}
        x2={mark.attackLine.x2}
        y2={mark.attackLine.y2}
        stroke="currentColor"
        strokeWidth={mark.attackLine.strokeWidth}
      />
      <circle cx={mark.ball.cx} cy={mark.ball.cy} r={mark.ball.radius} fill={BRAND_COLORS.ball} />
    </svg>
  );
}

// The mark locked to the "VolleyCoach" wordmark as one unit, never re-spaced or restyled per surface: the
// mark reads a touch taller than the wordmark (the design's ~1.16 mark-to-text ratio) and the gap is about
// a third of the mark's width. Keep at least one mark-width of clear space around it (see docs/brand.md).
export function BrandLockup({ size = 22 }: { size?: number }): JSX.Element {
  return (
    <span
      className="inline-flex items-center font-display font-bold tracking-[-0.02em] text-text"
      style={{ gap: size / 3, fontSize: size / 1.16 }}
    >
      <BrandMark size={size} />
      <span>VolleyCoach</span>
    </span>
  );
}
