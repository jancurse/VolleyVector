import { useRef, useState } from "react";
import type { JSX, PointerEvent } from "react";

import type { CourtCue } from "./Court";
import type { NormalizedPoint } from "./geometry";
import { labelFontSize, markerName, PLAYER_RADIUS } from "./Marker";
import { MARKER_COLORS, markerLabel, ROLES } from "./roles";
import type { Marker } from "./types";

// The rotation diagram: not a miniature court but a square 3×2 grid of the six official zones —
// front row 4-3-2 along the net tape, back row 5-6-1 below — a sketch of the rotation rather than a
// remake of the board. The front row carries the main court's front-zone shading and each zone wears
// a quiet corner numeral, so the sketch maps onto the court at a glance, and discs render at the
// court's own size so both surfaces share one icon language. With `onPlace` it is the custom-
// assignment surface: while players wait unassigned, a bench row appears below the grid, and
// dropping one inside a zone assigns it (the model side decides what a drop on an occupied zone
// does). With `onSelect` it is tappable instead, mirroring the court's "who do I key off" cue
// through the same `cue` shape. It speaks only normalized points; the board-model mapping stays
// with its caller.

const COL_W = 180; // one official zone's width, in this diagram's own SVG units
const ROW_H = 270; // one row's height: the grid stays square (540×540) like the half-court
const PAD = 28;
const GRID = COL_W * 3;
const NET_Y = PAD - 12;
const NUM_INSET = 24; // zone numeral centre, in from the zone's top-left corner

const BENCH_RADIUS = 32;
const BENCH_Y = PAD + GRID + 64;
const BENCH_BOTTOM = 60; // room below the bench row for its discs' shadows

const benchX = (i: number): number => PAD + (GRID * (i + 0.5)) / 6;

/** The zone a normalized point falls in, clamped into the grid. */
const zoneOf = (p: NormalizedPoint) => ({
  col: Math.min(2, Math.max(0, Math.floor(p.x * 3))),
  row: p.y < 0.5 ? 0 : 1,
});

const zoneCentre = (zone: { col: number; row: number }): NormalizedPoint => ({
  x: PAD + zone.col * COL_W + COL_W / 2,
  y: PAD + zone.row * ROW_H + ROW_H / 2,
});

/** A free point (a live drag) mapped linearly over the grid. */
const toLocal = (p: NormalizedPoint): NormalizedPoint => ({ x: PAD + p.x * GRID, y: PAD + p.y * GRID });

const inGrid = (p: NormalizedPoint): boolean => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;

/** Map a client coordinate into this diagram's normalized space through the SVG's on-screen matrix. */
function clientToNormalized(svg: SVGSVGElement, clientX: number, clientY: number): NormalizedPoint | null {
  const ctm = svg.getScreenCTM();

  if (!ctm) return null;

  const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());

  return { x: (point.x - PAD) / GRID, y: (point.y - PAD) / GRID };
}

/** A marker identity without a position — the diagram derives positions from zones and the bench. */
export type RotationMarker = Omit<Marker, "position">;

/** One official position: its number, its canonical point, and its occupant (if any). */
export type RotationSpot = {
  label: string;
  point: NormalizedPoint;
  marker?: RotationMarker;
};

function Disc({
  marker,
  point,
  radius,
  selected,
  dimmed,
  dragging,
  onPointerDown,
}: {
  marker: RotationMarker;
  point: NormalizedPoint;
  radius: number;
  selected: boolean;
  dimmed: boolean;
  dragging: boolean;
  onPointerDown?: (id: string, event: PointerEvent<SVGGElement>) => void;
}): JSX.Element {
  const style = marker.color ? MARKER_COLORS[marker.color] : ROLES[marker.role];
  const label = markerLabel(marker.role, marker.label);
  const scale = radius / PLAYER_RADIUS;
  const outerClass =
    [onPointerDown && "court-marker-hit", dimmed && "court-marker--dim"].filter(Boolean).join(" ") || undefined;

  return (
    <g
      transform={`translate(${point.x} ${point.y})`}
      role="img"
      aria-label={markerName(marker.role, label)}
      className={outerClass}
      onPointerDown={onPointerDown && ((event) => onPointerDown(marker.id, event))}
    >
      <circle className={`court-halo${selected ? " court-halo--on" : ""}`} r={radius + 9} />
      <g className={`court-marker${dragging ? " court-marker--dragging" : ""}`}>
        <circle className="court-marker-shadow" r={radius} />
        <circle r={radius} fill={style.fill} stroke={style.ring} strokeWidth={2.5 * scale} />
        <circle r={radius} fill="url(#court-rotation-sheen)" />
        <circle className="court-marker-edge" r={radius} fill="none" />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--font-mono)"
          fontWeight={700}
          fontSize={labelFontSize(label) * scale}
          fill={style.text}
        >
          {label}
        </text>
      </g>
    </g>
  );
}

type RotationDiagramProps = {
  /** The six official positions in slot order. */
  spots: readonly RotationSpot[];
  /** Unassigned players waiting on the bench (custom mode). */
  bench?: readonly RotationMarker[];
  /** Accessible name for the diagram. */
  label?: string;
  /** Custom mode: dropping a marker assigns it to `spots[index]`, or benches it with null. */
  onPlace?: (markerId: string, spotIndex: number | null) => void;
  /** View mode: tapping a disc reports it, tapping the surface reports null (the cue). */
  onSelect?: (id: string | null) => void;
  /** The court's "who do I key off" cue, mirrored between the involved zones. */
  cue?: CourtCue;
};

export function RotationDiagram({
  spots,
  bench = [],
  label = "Rotation board",
  onPlace,
  onSelect,
  cue,
}: RotationDiagramProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; point: NormalizedPoint } | null>(null);
  // The bench band exists only while someone waits on it, so a fully assigned card stays compact.
  const height = onPlace && bench.length > 0 ? BENCH_Y + BENCH_BOTTOM : PAD + GRID + PAD;
  const tappable = Boolean(onSelect) && !onPlace;

  const press = onPlace
    ? (id: string, event: PointerEvent<SVGGElement>) => {
        if (!svgRef.current) return;

        svgRef.current.setPointerCapture(event.pointerId);

        const point = clientToNormalized(svgRef.current, event.clientX, event.clientY);

        if (point) setDrag({ id, point });
      }
    : tappable
      ? (id: string, event: PointerEvent<SVGGElement>) => {
          event.stopPropagation();
          onSelect?.(id);
        }
      : undefined;

  // Releasing a drag assigns the marker to the zone it was dropped in, or benches it outside the
  // grid. The transient drag position clears, so a refused placement simply snaps back.
  const drop = () => {
    if (!drag) return;

    const zone = zoneOf(drag.point);
    const target = inGrid(drag.point)
      ? spots.findIndex((s) => zoneOf(s.point).col === zone.col && zoneOf(s.point).row === zone.row)
      : -1;
    const index = target === -1 ? null : target;
    const current = spots.findIndex((spot) => spot.marker?.id === drag.id);

    if (index !== (current === -1 ? null : current)) onPlace?.(drag.id, index);

    setDrag(null);
  };

  /** The zone centre an assigned marker renders at, for the cue's ties. */
  const centreOf = (id: string): NormalizedPoint | null => {
    const spot = spots.find((s) => s.marker?.id === id);

    return spot ? zoneCentre(zoneOf(spot.point)) : null;
  };

  // The dragged disc renders last, so it travels above the others.
  const discs = [
    ...spots.flatMap((spot) =>
      spot.marker ? [{ marker: spot.marker, point: zoneCentre(zoneOf(spot.point)), radius: PLAYER_RADIUS }] : []
    ),
    ...bench.map((marker, i) => ({ marker, point: { x: benchX(i), y: BENCH_Y }, radius: BENCH_RADIUS })),
  ].sort((a, b) => Number(a.marker.id === drag?.id) - Number(b.marker.id === drag?.id));

  return (
    <svg
      ref={svgRef}
      className={`court-rotation${onPlace ? " court-rotation--editable" : ""}${tappable ? " court-rotation--tap" : ""}`}
      viewBox={`0 0 ${PAD + GRID + PAD} ${height}`}
      aria-label={label}
      onPointerDown={tappable ? () => onSelect?.(null) : undefined}
      onPointerMove={(event) => {
        if (!drag) return;

        const point = clientToNormalized(event.currentTarget, event.clientX, event.clientY);

        if (point) setDrag({ id: drag.id, point });
      }}
      onPointerUp={drop}
      onPointerCancel={drop}
    >
      <defs>
        <linearGradient id="court-rotation-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.24} />
          <stop offset="48%" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0.16} />
        </linearGradient>
      </defs>

      <rect className="court-play" x={PAD} y={PAD} width={GRID} height={GRID} rx={5} />
      <rect className="court-zone" x={PAD} y={PAD} width={GRID} height={ROW_H} />
      <line className="court-rotation-line" x1={PAD + COL_W} y1={PAD} x2={PAD + COL_W} y2={PAD + GRID} />
      <line className="court-rotation-line" x1={PAD + COL_W * 2} y1={PAD} x2={PAD + COL_W * 2} y2={PAD + GRID} />
      <line className="court-rotation-line" x1={PAD} y1={PAD + ROW_H} x2={PAD + GRID} y2={PAD + ROW_H} />
      <rect className="court-boundary" x={PAD} y={PAD} width={GRID} height={GRID} rx={5} />
      <line className="court-net-tape" x1={PAD} y1={NET_Y} x2={PAD + GRID} y2={NET_Y} aria-hidden="true" />

      {spots.map(({ label: number, point, marker }) => {
        const zone = zoneOf(point);
        const centre = zoneCentre(zone);

        // Every zone wears its numeral in the corner; an empty zone marks the drop destination with
        // a dashed disc-sized outline at its centre.
        return (
          <g key={number} aria-hidden="true">
            <text
              className="court-rotation-num"
              x={PAD + zone.col * COL_W + NUM_INSET}
              y={PAD + zone.row * ROW_H + NUM_INSET}
            >
              {number}
            </text>
            {!marker && <circle className="court-spot" cx={centre.x} cy={centre.y} r={PLAYER_RADIUS} />}
          </g>
        );
      })}

      {cue &&
        (() => {
          const p = centreOf(cue.markerId);

          if (!p) return null;

          return (
            <g aria-hidden="true">
              {cue.neighbourIds.map((id) => {
                const q = centreOf(id);

                return q && <line key={id} className="court-cue-tie" x1={p.x} y1={p.y} x2={q.x} y2={q.y} />;
              })}
            </g>
          );
        })()}

      {discs.map(({ marker, point, radius }) => (
        <Disc
          key={marker.id}
          marker={marker}
          point={drag?.id === marker.id ? toLocal(drag.point) : point}
          radius={radius}
          selected={marker.id === cue?.markerId}
          dimmed={Boolean(cue && marker.id !== cue.markerId && !cue.neighbourIds.includes(marker.id))}
          dragging={drag?.id === marker.id}
          onPointerDown={press}
        />
      ))}
    </svg>
  );
}
