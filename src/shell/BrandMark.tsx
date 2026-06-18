import type { JSX } from "react";

// The app's brand mark: the board cropped to a rounded court (boundary + attack line) with the ball
// breaking the top-right corner, like a serve clearing the net. The single source for the in-product
// mark, mirrored by public/favicon.svg and documented in docs/brand.md.
//
// Monochrome and theme-aware: the court draws in the current text colour, so the mark sits quietly in the
// sidebar and flips with light/dark on its own. The amber ball is the one constant accent, knocked out
// from the court corner by a hairline ring in the surface colour so it stays crisp where they overlap.
export function BrandMark({ size = 22 }: { size?: number }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="flex-none">
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <line x1="3.5" y1="9.2" x2="20.5" y2="9.2" stroke="currentColor" strokeWidth="1.4" opacity="0.7" />
      <circle cx="20.5" cy="3.5" r="3.4" fill="var(--court-surface)" />
      <circle cx="20.5" cy="3.5" r="2.8" fill="#e8973a" />
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
