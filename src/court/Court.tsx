import { useRef } from "react";
import type { JSX } from "react";

import { Arrows } from "./Arrows";
import { ATTACK_LINE, COURT_SPAN, toSvg, VIEW_SIZE } from "./geometry";
import type { NormalizedPoint } from "./geometry";
import { CourtGrid } from "./Grid";
import { Marker } from "./Marker";
import type { Arrow, Marker as MarkerData } from "./types";
import { useMarkerDrag } from "./useMarkerDrag";

// The single court component, shared by static tactics and individual drill steps. It draws the
// playing surface, its lines, the net, and the given markers. Passing both `onSelect` and `onMove`
// turns it into an editable surface (select, drag); without them it renders as a static diagram.

const NET_BAND = 54; // height of the net mesh above the top line, in SVG units
const NET_STRANDS = 26;

const left = toSvg(0);
const right = toSvg(1);
const netLine = toSvg(0);
const netTape = netLine - NET_BAND;

const noSelect = (_id: string | null): void => {};
const noMove = (_id: string, _position: NormalizedPoint): void => {};

type CourtProps = {
  markers: readonly MarkerData[];
  /** Accessible name for the whole diagram. */
  label?: string;
  selectedId?: string | null;
  /** When true, markers glide between positions (drill playback) instead of jumping. */
  animated?: boolean;
  /** Derived movement arrows to overlay (drill steps); drawn beneath the markers. */
  arrows?: readonly Arrow[];
  /** Faint reference grid: the number of cells per axis (0 = off). An authoring aid. */
  grid?: number;
  /** Optional transform applied to each dragged position, e.g. snapping it to the grid. */
  snap?: (position: NormalizedPoint) => NormalizedPoint;
  /** Provide both `onSelect` and `onMove` to make the court an editable surface. */
  onSelect?: (id: string | null) => void;
  onMove?: (id: string, position: NormalizedPoint) => void;
};

export function Court({
  markers,
  label = "Volleyball half-court",
  selectedId = null,
  animated = false,
  arrows,
  grid = 0,
  snap,
  onSelect,
  onMove,
}: CourtProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);
  const editable = Boolean(onSelect && onMove);
  const drag = useMarkerDrag(svgRef, onSelect ?? noSelect, onMove ?? noMove, snap);

  return (
    <svg
      ref={svgRef}
      className={`court${editable ? " court--editable" : ""}`}
      viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
      aria-label={label}
      onPointerDown={editable ? drag.onSurfacePointerDown : undefined}
      onPointerMove={editable ? drag.onPointerMove : undefined}
      onPointerUp={editable ? drag.onPointerUp : undefined}
      onPointerCancel={editable ? drag.onPointerUp : undefined}
    >
      <defs>
        {/* Soft top-light to bottom-shade overlay that gives every marker disc a tactile, lit-from-above
            feel without per-colour stops: object-bounding-box, so it spans each disc whatever its size. */}
        <linearGradient id="court-marker-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.24} />
          <stop offset="48%" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0.16} />
        </linearGradient>
      </defs>

      <rect className="court-play" x={left} y={toSvg(0)} width={COURT_SPAN} height={COURT_SPAN} rx={4} />
      <rect className="court-zone" x={left} y={toSvg(0)} width={COURT_SPAN} height={ATTACK_LINE * COURT_SPAN} />

      <CourtGrid divisions={grid} />

      <rect className="court-boundary" x={left} y={toSvg(0)} width={COURT_SPAN} height={COURT_SPAN} rx={4} />
      <line className="court-attack" x1={left} y1={toSvg(ATTACK_LINE)} x2={right} y2={toSvg(ATTACK_LINE)} />

      <g className="court-net" aria-hidden="true">
        <line className="court-net-tape" x1={left} y1={netTape} x2={right} y2={netTape} />
        {Array.from({ length: NET_STRANDS + 1 }, (_, i) => {
          const x = toSvg(i / NET_STRANDS);

          return <line key={i} className="court-net-strand" x1={x} y1={netTape} x2={x} y2={netLine} />;
        })}
        <line className="court-net-post" x1={left} y1={netTape - 14} x2={left} y2={netLine} />
        <line className="court-net-post" x1={right} y1={netTape - 14} x2={right} y2={netLine} />
      </g>

      {arrows && arrows.length > 0 && <Arrows arrows={arrows} />}

      {markers.map((marker, i) => (
        <Marker
          key={marker.id}
          marker={marker}
          index={i}
          selected={marker.id === selectedId}
          dragging={marker.id === drag.draggingId}
          animated={animated}
          onPointerDown={editable ? drag.onMarkerPointerDown : undefined}
        />
      ))}
    </svg>
  );
}
