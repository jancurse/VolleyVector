import type { JSX, PointerEvent } from "react";

import { toSvgPoint } from "./geometry";
import { MARKER_COLORS, markerLabel, ROLES } from "./roles";
import type { Marker as MarkerData } from "./types";

const PLAYER_RADIUS = 46;
const BALL_RADIUS = 34;

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
  /** When provided, the marker is interactive: pressing it starts a select/drag. */
  onPointerDown?: (id: string, event: PointerEvent) => void;
};

export function Marker({
  marker,
  index = 0,
  selected = false,
  dragging = false,
  onPointerDown,
}: MarkerProps): JSX.Element {
  const { x, y } = toSvgPoint(marker.position);
  const style = marker.color ? MARKER_COLORS[marker.color] : ROLES[marker.role];
  const isBall = marker.role === "ball";
  const label = markerLabel(marker.role, marker.label);
  const radius = isBall ? BALL_RADIUS : PLAYER_RADIUS;

  // Outer group carries the position (an SVG transform) and any interaction; the inner group owns
  // the entrance/lift animations, so a CSS transform never clobbers the marker's placement.
  return (
    <g
      transform={`translate(${x} ${y})`}
      role="img"
      aria-label={isBall ? "Ball" : accessibleName(marker.role, label)}
      className={onPointerDown ? "vc-marker-hit" : undefined}
      onPointerDown={onPointerDown && ((event) => onPointerDown(marker.id, event))}
    >
      <circle className={`vc-halo${selected ? " vc-halo--on" : ""}`} r={radius + 9} />
      <g
        className={`vc-marker${dragging ? " vc-marker--dragging" : ""}`}
        style={{ animationDelay: `${0.35 + index * 0.06}s` }}
      >
        {isBall ? (
          <>
            <circle r={BALL_RADIUS} fill={style.fill} stroke={style.ring} strokeWidth={2.5} />
            <path
              d={`M ${-BALL_RADIUS} -6 Q 0 -22 ${BALL_RADIUS} -6 M ${-BALL_RADIUS} 6 Q 0 22 ${BALL_RADIUS} 6`}
              fill="none"
              stroke={style.ring}
              strokeWidth={2.5}
              strokeLinecap="round"
              opacity={0.7}
            />
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
    </g>
  );
}
