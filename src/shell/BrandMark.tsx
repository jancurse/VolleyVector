import type { JSX } from "react";

// The app's brand mark, the custom court-grid glyph mirrored by public/favicon.svg: the one
// hand-drawn icon outside the court's domain art.
export function BrandMark({ size = 22 }: { size?: number }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="flex-none opacity-90">
      <rect x="3" y="3" width="18" height="18" rx="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="15" r="2.1" fill="currentColor" />
    </svg>
  );
}
