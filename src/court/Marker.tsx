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
export function markerName(role: MarkerData["role"], label: string, opponent = false): string {
  const number = label.match(/\d+$/)?.[0];
  const name = number ? `${ROLES[role].name} ${number}` : ROLES[role].name;

  return opponent ? `Opponent ${name.toLowerCase()}` : name;
}

// A player's body: a disc for our side, a rounded square for an opponent, so the two teams stay
// apart at thumbnail size and in greyscale rather than by colour alone.
type ShapeProps = { r: number; className?: string; fill?: string; stroke?: string; strokeWidth?: number };

export function Shape({ opponent, r, ...props }: ShapeProps & { opponent: boolean }): JSX.Element {
  return opponent ? (
    <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={r * 0.32} {...props} />
  ) : (
    <circle r={r} {...props} />
  );
}

type MarkerProps = {
  marker: MarkerData;
  /** Position in the entrance stagger; later markers settle in slightly after earlier ones. */
  index?: number;
  selected?: boolean;
  /** A solo overlap fault (outside the area, or a libero up front): the selection halo's grammar in
   *  the danger token. A pair violation carries no halo — its red edge does. */
  fault?: boolean;
  /** Steps the marker back while another player's selection spotlight is showing. */
  dimmed?: boolean;
  dragging?: boolean;
  /** When true the marker glides to new positions (drill playback) instead of jumping there. */
  animated?: boolean;
  /** Thumbnail mode: the disc grows so the formation reads small, and the label is dropped. */
  compact?: boolean;
  /** When provided, the marker is interactive: pressing it starts a select/drag. */
  onPointerDown?: (id: string, event: PointerEvent) => void;
};

export function Marker({
  marker,
  index = 0,
  selected = false,
  fault = false,
  dimmed = false,
  dragging = false,
  animated = false,
  compact = false,
  onPointerDown,
}: MarkerProps): JSX.Element {
  const { x, y } = toSvgPoint(marker.position);
  const style = marker.color ? MARKER_COLORS[marker.color] : ROLES[marker.role];
  const isBall = marker.role === "ball";
  const opponent = marker.side === "opponent" && !isBall;
  const label = markerLabel(marker.role, marker.label);
  const scale = compact ? 1.25 : 1;
  const radius = (isBall ? BALL_RADIUS : PLAYER_RADIUS) * scale;

  // The inner group owns the entrance/lift animations, so a CSS transform never clobbers placement.
  const body = (
    <>
      <Shape
        opponent={opponent}
        className={`court-halo${selected || fault ? " court-halo--on" : ""}${!selected && fault ? " court-halo--fault" : ""}`}
        r={radius + 9}
      />
      <g
        className={`court-marker${dragging ? " court-marker--dragging" : ""}`}
        style={{ animationDelay: `${0.35 + index * 0.06}s` }}
      >
        {/* A hidden caster behind the disc carries the only filter, so the disc, ring, and label all
            stay crisp vector while still casting a soft shadow. */}
        <Shape opponent={opponent} className="court-marker-shadow" r={radius} />
        <g className="court-marker-body">
          {isBall ? (
            <g transform={`scale(${scale})`}>
              <BallArt />
            </g>
          ) : (
            <>
              <Shape opponent={opponent} r={radius} fill={style.fill} stroke={style.ring} strokeWidth={2.5 * scale} />
              <Shape opponent={opponent} r={radius} fill="url(#court-marker-sheen)" />
              <Shape opponent={opponent} className="court-marker-edge" r={radius} fill="none" />
            </>
          )}
        </g>
        {!isBall && !compact && (
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

  const name = isBall ? "Ball" : markerName(marker.role, label, opponent);

  const outerClass =
    [onPointerDown && "court-marker-hit", dimmed && "court-marker--dim"].filter(Boolean).join(" ") || undefined;

  // Playback: the outer group carries position as an animated CSS transform, so a step change glides.
  if (animated) {
    return (
      <motion.g
        role="img"
        aria-label={name}
        className={outerClass}
        initial={false}
        animate={{ x, y }}
        transition={{ duration: STEP_TRAVEL_S, ease: EASE_SETTLE }}
        onPointerDown={onPointerDown && ((event) => onPointerDown(marker.id, event))}
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
      className={outerClass}
      onPointerDown={onPointerDown && ((event) => onPointerDown(marker.id, event))}
    >
      {body}
    </g>
  );
}
