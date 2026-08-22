import { useId } from "react";
import type { JSX } from "react";

import { labelFontSize, MarkerBody, PLAYER_RADIUS } from "./Marker";

// The player disc as a standalone glyph, sized by its container — the marker peer of BallSwatch.
// It layers the same fill, ring, sheen, and theme edge as the on-court disc in Marker (minus the
// court-only halo and shadow), so a swatch shows exactly what lands on the board.
type MarkerSwatchProps = {
  fill: string;
  ring: string;
  /** Label colour, needed only when a code is shown. */
  text?: string;
  /** The role code rendered inside the disc; omitted for plain colour swatches. */
  code?: string;
  /** Draws the opponent's square body instead of a disc. */
  opponent?: boolean;
};

export function MarkerSwatch({ fill, ring, text, code, opponent = false }: MarkerSwatchProps): JSX.Element {
  // useId may carry characters that break a url(#…) reference, so strip to a safe id.
  const sheenId = `swatch-${useId().replace(/\W/g, "")}`;

  return (
    <svg viewBox="-42 -42 84 84" className="size-full" aria-hidden="true">
      <defs>
        {/* Mirrors Court's shared #court-marker-sheen, defined locally so the swatch stands alone. */}
        <linearGradient id={sheenId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.24} />
          <stop offset="48%" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0.16} />
        </linearGradient>
      </defs>
      <MarkerBody opponent={opponent} r={PLAYER_RADIUS} fill={fill} stroke={ring} strokeWidth={2.5} />
      <MarkerBody opponent={opponent} r={PLAYER_RADIUS} fill={`url(#${sheenId})`} />
      <MarkerBody opponent={opponent} className="court-marker-edge" r={PLAYER_RADIUS} fill="none" />
      {code && (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--font-mono)"
          fontWeight={700}
          fontSize={labelFontSize(code)}
          fill={text}
        >
          {code}
        </text>
      )}
    </svg>
  );
}
