import { useId } from "react";
import type { JSX } from "react";

// The ball is a fixed-colour object (not theme- or role-dependent): the blue-and-yellow Mikasa
// V200W, its three blue blades pinwheeling over a yellow base around the classic curved seams, so
// it stays recognisable and legible on both the light and dark court.
const BALL_BLUE = "#1652C0";
const BALL_YELLOW = "#FFC61E";
const BALL_SEAM = "#16224A";
const BALL_RADIUS = 30;

// One blue arm of the V200W swirl: a slender curved blade sweeping from the blue centre hub out to
// a narrow tip at the rim, drawn three times at 120°. The three arms converge into a rounded blue
// centre (BALL_HUB_R), and the wide yellow gaps between them dominate the ball's surface.
const BALL_BLADE = "M 0 0 C -6 -12 0 -26 11.6 -31.9 A 34 34 0 0 1 24 -24 C 16 -16 8 -6 0 0 Z";
const BALL_HUB_R = 9;

/** The volleyball artwork at its native radius (30 SVG units), centred on the origin. Shared by the
    court marker and the swatch, so the ball looks the same wherever it appears. */
export function BallArt(): JSX.Element {
  // useId may carry characters that break a url(#…) reference, so strip to a safe id.
  const clipId = `ball-${useId().replace(/\W/g, "")}`;

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <circle r={BALL_RADIUS} />
        </clipPath>
        <radialGradient id={`${clipId}-sheen`} cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.5} />
          <stop offset="42%" stopColor="#FFFFFF" stopOpacity={0.06} />
          <stop offset="100%" stopColor="#0B1430" stopOpacity={0.22} />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <circle r={BALL_RADIUS} fill={BALL_YELLOW} />
        {[0, 120, 240].map((deg) => (
          <path key={deg} d={BALL_BLADE} fill={BALL_BLUE} transform={`rotate(${deg})`} />
        ))}
        <circle r={BALL_HUB_R} fill={BALL_BLUE} />
        {[0, 120, 240].map((deg) => (
          <path
            key={deg}
            d={BALL_BLADE}
            fill="none"
            stroke={BALL_SEAM}
            strokeWidth={1.2}
            strokeOpacity={0.35}
            transform={`rotate(${deg})`}
          />
        ))}
        <circle r={BALL_RADIUS} fill={`url(#${clipId}-sheen)`} />
      </g>
      <circle r={BALL_RADIUS} fill="none" stroke={BALL_SEAM} strokeWidth={2.4} opacity={0.34} />
    </>
  );
}

/** The ball as a standalone glyph, sized by its container — for the role swatches and palette. */
export function BallSwatch(): JSX.Element {
  return (
    <svg viewBox="-30 -30 60 60" className="size-full" aria-hidden="true">
      <BallArt />
    </svg>
  );
}
