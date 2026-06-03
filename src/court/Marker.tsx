import { motion } from "motion/react";
import type { JSX, PointerEvent } from "react";

import { toSvgPoint } from "./geometry";
import { EASE_SETTLE, STEP_TRAVEL_S } from "./motion";
import { MARKER_COLORS, markerLabel, ROLES } from "./roles";
import type { Marker as MarkerData } from "./types";

const PLAYER_RADIUS = 46;
const BALL_RADIUS = 34;

// The ball is a fixed-colour object (not theme- or role-dependent): the blue-and-yellow Mikasa
// V200W, its three blue blades pinwheeling over a yellow base around the classic curved seams, so
// it stays recognisable and legible on both the light and dark court.
const BALL_BLUE = "#1652C0";
const BALL_YELLOW = "#FFC61E";
const BALL_SEAM = "#16224A";

// One blue arm of the V200W swirl: a slender curved blade sweeping from the blue centre hub out to
// a narrow tip at the rim, drawn three times at 120°. The three arms converge into a rounded blue
// centre (BALL_HUB_R), and the wide yellow gaps between them dominate the ball's surface.
const BALL_BLADE = "M 0 0 C -6 -12 0 -26 11.6 -31.9 A 34 34 0 0 1 24 -24 C 16 -16 8 -6 0 0 Z";
const BALL_HUB_R = 9;

// Shrink the label as it gets longer so "OPP" still fits the disc as comfortably as "S".
function labelFontSize(label: string): number {
  if (label.length <= 1) return 46;

  return label.length === 2 ? 40 : 30;
}

// "OH1" -> "Outside hitter 1"; "S" -> "Setter". Used as the marker's accessible name.
function accessibleName(role: MarkerData["role"], label: string): string {
  const number = label.match(/\d+$/)?.[0];

  return number ? `${ROLES[role].name} ${number}` : ROLES[role].name;
}

type MarkerProps = {
  marker: MarkerData;
  /** Position in the entrance stagger; later markers settle in slightly after earlier ones. */
  index?: number;
  selected?: boolean;
  dragging?: boolean;
  /** When true the marker glides to new positions (drill playback) instead of jumping there. */
  animated?: boolean;
  /** When provided, the marker is interactive: pressing it starts a select/drag. */
  onPointerDown?: (id: string, event: PointerEvent) => void;
};

export function Marker({
  marker,
  index = 0,
  selected = false,
  dragging = false,
  animated = false,
  onPointerDown,
}: MarkerProps): JSX.Element {
  const { x, y } = toSvgPoint(marker.position);
  const style = marker.color ? MARKER_COLORS[marker.color] : ROLES[marker.role];
  const isBall = marker.role === "ball";
  const label = markerLabel(marker.role, marker.label);
  const radius = isBall ? BALL_RADIUS : PLAYER_RADIUS;
  const clipId = `vc-ball-${marker.id}`;

  // The inner group owns the entrance/lift animations, so a CSS transform never clobbers placement.
  const body = (
    <>
      <circle className={`vc-halo${selected ? " vc-halo--on" : ""}`} r={radius + 9} />
      <g
        className={`vc-marker${dragging ? " vc-marker--dragging" : ""}`}
        style={{ animationDelay: `${0.35 + index * 0.06}s` }}
      >
        {isBall ? (
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
        ) : (
          <>
            <circle r={PLAYER_RADIUS} fill={style.fill} stroke={style.ring} strokeWidth={3} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="var(--font-mono)"
              fontWeight={700}
              fontSize={labelFontSize(label)}
              fill={style.text}
            >
              {label}
            </text>
          </>
        )}
      </g>
    </>
  );

  const name = isBall ? "Ball" : accessibleName(marker.role, label);

  // Playback: the outer group carries position as an animated CSS transform, so a step change glides.
  if (animated) {
    return (
      <motion.g
        role="img"
        aria-label={name}
        initial={false}
        animate={{ x, y }}
        transition={{ duration: STEP_TRAVEL_S, ease: EASE_SETTLE }}
      >
        {body}
      </motion.g>
    );
  }

  // Editor / static: the outer group carries position as an SVG transform that tracks a drag exactly.
  return (
    <g
      transform={`translate(${x} ${y})`}
      role="img"
      aria-label={name}
      className={onPointerDown ? "vc-marker-hit" : undefined}
      onPointerDown={onPointerDown && ((event) => onPointerDown(marker.id, event))}
    >
      {body}
    </g>
  );
}
