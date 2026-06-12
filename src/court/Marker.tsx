import { motion } from "motion/react";
import type { JSX, PointerEvent } from "react";

import { BallArt } from "./BallArt";
import { toSvgPoint } from "./geometry";
import { EASE_SETTLE, STEP_TRAVEL_S } from "./motion";
import { MARKER_COLORS, markerLabel, ROLES } from "./roles";
import type { Marker as MarkerData } from "./types";

export const PLAYER_RADIUS = 40;
const BALL_RADIUS = 30;

// Shrink the label as it gets longer so "OPP" still fits the disc as comfortably as "S".
export function labelFontSize(label: string): number {
  if (label.length <= 1) return 40;

  return label.length === 2 ? 34 : 26;
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
  /** Marks an overlap violation: the selection halo's grammar in the warning token. */
  warning?: boolean;
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
  warning = false,
  dragging = false,
  animated = false,
  onPointerDown,
}: MarkerProps): JSX.Element {
  const { x, y } = toSvgPoint(marker.position);
  const style = marker.color ? MARKER_COLORS[marker.color] : ROLES[marker.role];
  const isBall = marker.role === "ball";
  const label = markerLabel(marker.role, marker.label);
  const radius = isBall ? BALL_RADIUS : PLAYER_RADIUS;

  // The inner group owns the entrance/lift animations, so a CSS transform never clobbers placement.
  const body = (
    <>
      <circle
        className={`court-halo${selected || warning ? " court-halo--on" : ""}${!selected && warning ? " court-halo--warn" : ""}`}
        r={radius + 9}
      />
      <g
        className={`court-marker${dragging ? " court-marker--dragging" : ""}`}
        style={{ animationDelay: `${0.35 + index * 0.06}s` }}
      >
        {/* A hidden caster behind the disc carries the only filter, so the disc, ring, and label all
            stay crisp vector while still casting a soft shadow. */}
        <circle className="court-marker-shadow" r={radius} />
        <g className="court-marker-body">
          {isBall ? (
            <BallArt />
          ) : (
            <>
              <circle r={PLAYER_RADIUS} fill={style.fill} stroke={style.ring} strokeWidth={2.5} />
              <circle r={PLAYER_RADIUS} fill="url(#court-marker-sheen)" />
              <circle className="court-marker-edge" r={PLAYER_RADIUS} fill="none" />
            </>
          )}
        </g>
        {!isBall && (
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
      className={onPointerDown ? "court-marker-hit" : undefined}
      onPointerDown={onPointerDown && ((event) => onPointerDown(marker.id, event))}
    >
      {body}
    </g>
  );
}
