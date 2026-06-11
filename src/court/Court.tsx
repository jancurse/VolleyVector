import { useRef, useState } from "react";
import type { JSX } from "react";

import type { AnnotationHandle } from "../boards/operations";
import { Annotations } from "./Annotations";
import { Arrows } from "./Arrows";
import type { SnapResult } from "./snapping";
import { ATTACK_LINE, COURT_SPAN, toSvg, toSvgPoint, VIEW_SIZE } from "./geometry";
import type { NormalizedPoint } from "./geometry";
import { CourtGrid } from "./Grid";
import { Marker } from "./Marker";
import { MARKER_COLORS } from "./roles";
import type { Annotation, AnnotationTool, Arrow, Marker as MarkerData, NewAnnotationStyle } from "./types";
import { useAnnotationDraw } from "./useAnnotationDraw";
import { clientToNormalized, useMarkerDrag } from "./useMarkerDrag";

// The single court component, shared by static tactics and individual drill steps. It draws the
// playing surface, its lines, the net, the given markers, and any drawn annotations. Passing both
// `onSelect` and `onMove` turns it into an editable marker surface; passing `onDrawAnnotation` adds the
// annotation tools. The active `tool` chooses which interaction the surface drives. Without any of
// these it renders as a static diagram.

const NET_BAND = 54; // height of the net mesh above the top line, in SVG units
const NET_STRANDS = 26;

// The armed-tool tip trails the crosshair by this offset (SVG units), clear of the precision point.
const TIP_OFFSET = 30;

const left = toSvg(0);
const right = toSvg(1);
const netLine = toSvg(0);
const netTape = netLine - NET_BAND;

const noSelect = (_id: string | null): void => {};
const noMove = (_id: string, _position: NormalizedPoint): void => {};
const noDraw = (_annotation: Annotation): void => {};
const noTranslate = (_id: string, _dx: number, _dy: number): void => {};
const DEFAULT_ANNOTATION_STYLE: NewAnnotationStyle = { color: "blue", width: 6, fill: "tint", dash: "solid" };

export type CourtWarnings = {
  markerIds: readonly string[];
  ties: readonly { a: string; b: string }[];
};

type CourtProps = {
  markers: readonly MarkerData[];
  /** Accessible name for the whole diagram. */
  label?: string;
  selectedId?: string | null;
  /** When true, markers glide between positions (drill playback) instead of jumping. */
  animated?: boolean;
  /** Derived movement arrows to overlay (drill steps); drawn beneath the markers. */
  arrows?: readonly Arrow[];
  /** The step's drawn annotations, rendered between the arrows and the markers. */
  annotations?: readonly Annotation[];
  /** Overlap-violation flags: markers carrying a warning halo, and a tie per broken pair. */
  warnings?: CourtWarnings;
  /** Empty official-position outlines (the rotation board's unfilled spots), drawn beneath the markers. */
  spots?: readonly { point: NormalizedPoint; label: string }[];
  /** Faint reference grid: the number of cells per axis (0 = off). An authoring aid. */
  grid?: number;
  /** Optional transform applied to each dragged position, e.g. snapping it to the grid. */
  snap?: (position: NormalizedPoint) => NormalizedPoint;
  /** Provide both `onSelect` and `onMove` to make the court an editable marker surface. */
  onSelect?: (id: string | null) => void;
  onMove?: (id: string, position: NormalizedPoint) => void;
  /** The active editor tool. `markers` (default) edits markers; other tools draw or select shapes. */
  tool?: AnnotationTool;
  /** Colour, width, and (for closed shapes) fill applied to a freshly drawn shape. */
  annotationStyle?: NewAnnotationStyle;
  selectedAnnotationId?: string | null;
  onSelectAnnotation?: (id: string | null) => void;
  /** Provide to enable the annotation tools: called with each committed shape. */
  onDrawAnnotation?: (annotation: Annotation) => void;
  /** Move a shape by a normalized delta (the select tool's drag). */
  onTranslateAnnotation?: (id: string, dx: number, dy: number) => void;
  /** Move one handle of the selected shape (the select tool's reshape drag). */
  onReshapeAnnotation?: (id: string, handle: AnnotationHandle, point: NormalizedPoint) => void;
  /** Magnetic snapping for drawn/reshaped annotation points; the court shows a dot where it locks. */
  annotationSnap?: (point: NormalizedPoint) => SnapResult;
  /** Fired when any pointer gesture on the surface ends — the editor's cue to commit it to history. */
  onGestureEnd?: () => void;
};

export function Court({
  markers,
  label = "Volleyball half-court",
  selectedId = null,
  animated = false,
  arrows,
  annotations,
  warnings,
  spots,
  grid = 0,
  snap,
  onSelect,
  onMove,
  tool = "markers",
  annotationStyle = DEFAULT_ANNOTATION_STYLE,
  selectedAnnotationId = null,
  onSelectAnnotation,
  onDrawAnnotation,
  onTranslateAnnotation,
  onReshapeAnnotation,
  annotationSnap,
  onGestureEnd,
}: CourtProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<NormalizedPoint | null>(null);
  const editable = Boolean(onSelect && onMove);
  const drag = useMarkerDrag(svgRef, onSelect ?? noSelect, onMove ?? noMove, snap);
  const draw = useAnnotationDraw(svgRef, {
    tool,
    style: annotationStyle,
    onDraw: onDrawAnnotation ?? noDraw,
    onSelect: onSelectAnnotation ?? noSelect,
    onTranslate: onTranslateAnnotation ?? noTranslate,
    onReshape: onReshapeAnnotation,
    snapPoint: annotationSnap,
  });

  // An annotation tool (drawing or select) is active when the editor wired the handlers and the tool is
  // not `markers`; then the surface drives drawing/selecting instead of marker dragging.
  const drawingTool = Boolean(onDrawAnnotation) && tool !== "markers";
  const interactive = editable || drawingTool;

  const surface = drawingTool ? draw : editable ? drag : null;
  const crosshair = drawingTool && tool !== "select";

  return (
    <svg
      ref={svgRef}
      className={`court${interactive ? " court--editable" : ""}${crosshair ? " court--draw" : ""}`}
      viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
      aria-label={label}
      onPointerDown={surface?.onSurfacePointerDown}
      onPointerMove={(event) => {
        surface?.onPointerMove(event);
        if (crosshair) setHover(clientToNormalized(event.currentTarget, event.clientX, event.clientY));
      }}
      onPointerLeave={() => setHover(null)}
      onPointerUp={() => {
        surface?.onPointerUp();
        onGestureEnd?.();
      }}
      onPointerCancel={() => {
        surface?.onPointerUp();
        onGestureEnd?.();
      }}
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

      {((annotations && annotations.length > 0) || draw.draft) && (
        <Annotations
          annotations={annotations ?? []}
          draft={draw.draft}
          selectedId={tool === "select" ? selectedAnnotationId : null}
          onShapePointerDown={tool === "select" ? draw.onShapePointerDown : undefined}
          onHandlePointerDown={tool === "select" && onReshapeAnnotation ? draw.onHandlePointerDown : undefined}
        />
      )}

      {/* The in-progress polygon's finish cues: a dot on the first and last placed vertex, warming to
          the accent when the cursor is in closing range — click either to finish the shape. */}
      {draw.closeTargets?.map(({ point, hot }, i) => (
        <circle
          key={i}
          className={`court-poly-target${hot ? " court-poly-target--hot" : ""}`}
          cx={toSvgPoint(point).x}
          cy={toSvgPoint(point).y}
          r={hot ? 14 : 9}
        />
      ))}

      {draw.snapTarget && (
        <circle
          className="court-snap-dot"
          cx={toSvgPoint(draw.snapTarget).x}
          cy={toSvgPoint(draw.snapTarget).y}
          r={8}
        />
      )}

      {spots?.map(({ point, label }) => {
        const { x, y } = toSvgPoint(point);

        return (
          <g key={label} aria-hidden="true">
            <circle className="court-spot" cx={x} cy={y} r={46} />
            <text className="court-spot-label" x={x} y={y}>
              {label}
            </text>
          </g>
        );
      })}

      {warnings?.ties.map(({ a, b }, i) => {
        const from = markers.find((m) => m.id === a);
        const to = markers.find((m) => m.id === b);

        if (!from || !to) return null;

        const p = toSvgPoint(from.position);
        const q = toSvgPoint(to.position);

        return <line key={i} className="court-tie" x1={p.x} y1={p.y} x2={q.x} y2={q.y} />;
      })}

      {markers.map((marker, i) => (
        <Marker
          key={marker.id}
          marker={marker}
          index={i}
          selected={marker.id === selectedId}
          warning={warnings?.markerIds.includes(marker.id)}
          dragging={marker.id === drag.draggingId}
          animated={animated}
          onPointerDown={editable && tool === "markers" ? drag.onMarkerPointerDown : undefined}
        />
      ))}

      {/* The armed-tool tip: a swatch in the next shape's colour and weight trailing the crosshair, so
          which tool is armed (and that it stays armed after a commit) is visible on the court itself.
          Hidden mid-gesture, where the live draft already shows the style. */}
      {crosshair && hover && !draw.draft && (
        <circle
          className="court-tool-tip"
          style={{ color: MARKER_COLORS[annotationStyle.color].fill }}
          cx={toSvgPoint(hover).x + TIP_OFFSET}
          cy={toSvgPoint(hover).y + TIP_OFFSET}
          r={4 + annotationStyle.width / 2}
        />
      )}
    </svg>
  );
}
