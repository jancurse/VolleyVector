import { useId } from "react";
import type { JSX, PointerEvent } from "react";

import type { AnnotationHandle } from "../boards/operations";
import { AnnotationHandles } from "./AnnotationHandles";
import { arrowSegment, curvedArrowSegment } from "./Arrows";
import { freehandPath } from "./freehand";
import { toSvgPoint } from "./geometry";
import type { NormalizedPoint } from "./geometry";
import { MARKER_COLORS } from "./roles";
import type { Annotation, AnnotationFill, StrokedAnnotation } from "./types";

// The drawn-annotation layer, sibling to Arrows. It maps each per-step annotation to one themed SVG
// element coloured from the marker palette, and (in the editor's select tool) gives each a wide
// invisible hit target so even a thin line is grabbable. The whole layer is non-interactive by default
// (pointer-events off), so it never blocks marker dragging or a surface deselect; the hit targets
// switch interaction back on only when selecting is active.

// Half-extent of a line/arrow's invisible hit target, in SVG units — wide enough to grab a thin line.
const HIT_WIDTH = 30;

// A text label's font size in SVG units per stroke-width option (thin/medium/bold).
const TEXT_SIZES: Record<number, number> = { 5: 34, 8: 46, 14: 62 };

/** The font size (SVG units) a text annotation's `width` maps to. */
export function textSize(width: number): number {
  return TEXT_SIZES[width] ?? 46;
}

// Rough glyph width as a fraction of the font size, for a text label's hit box.
const TEXT_ASPECT = 0.6;

type Box = { x: number; y: number; w: number; h: number };

/** A text label's hit box around its centre `at`, estimated from its length (SVG units). */
function textBox(annotation: Annotation & { kind: "text" }): Box {
  const { x, y } = toSvgPoint(annotation.at);
  const size = textSize(annotation.width);
  const w = Math.max(annotation.text.length, 2) * size * TEXT_ASPECT;
  const h = size * 1.3;

  return { x: x - w / 2, y: y - h / 2, w, h };
}

/** The min-corner and size of a two-corner shape in SVG space (so `a`/`b` may be given in any order). */
function box(a: NormalizedPoint, b: NormalizedPoint): Box {
  const p = toSvgPoint(a);
  const q = toSvgPoint(b);

  return { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), w: Math.abs(q.x - p.x), h: Math.abs(q.y - p.y) };
}

/** The SVG-space bounding box of a polygon's vertices. */
function pointsBox(points: readonly NormalizedPoint[]): Box {
  const svg = points.map(toSvgPoint);
  const xs = svg.map((p) => p.x);
  const ys = svg.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);

  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** A polygon's vertices as an SVG `points` attribute. */
function polygonPoints(points: readonly NormalizedPoint[]): string {
  return points
    .map((p) => {
      const { x, y } = toSvgPoint(p);

      return `${x},${y}`;
    })
    .join(" ");
}

/** The fill attributes a closed shape's main element takes (hachure draws as a separate layer). */
function fillAttrs(fill: AnnotationFill): { fill: string; fillOpacity?: number } {
  return fill === "tint" ? { fill: "currentColor", fillOpacity: 0.16 } : { fill: "none" };
}

/** The dash attribute a stroked shape takes; geometry scales with the stroke width (the round caps
 *  swallow half a width at each dash end, so the gap stays visibly open even on a bold stroke). */
function dashAttrs(annotation: StrokedAnnotation): { strokeDasharray?: string } {
  return annotation.dash === "dashed" ? { strokeDasharray: `${annotation.width * 2.4} ${annotation.width * 2.2}` } : {};
}

// The hachure fill's geometry (SVG units): line spacing and weight, tuned to stay legible at
// thumbnail size without overpowering the shape's own stroke.
const HATCH_GAP = 22;
const HATCH_WIDTH = 3.5;

/** The hand-drawn hachure fill: deterministic 45° lines in the shape's colour, clipped to `clip`. */
function Hachure({ box: b, clip }: { box: Box; clip: JSX.Element }): JSX.Element {
  const id = useId();

  return (
    <g className="court-annotation-hachure" clipPath={`url(#${id})`}>
      <clipPath id={id}>{clip}</clipPath>
      {Array.from({ length: Math.ceil((b.w + b.h) / HATCH_GAP) }, (_, i) => {
        const k = i * HATCH_GAP - b.h;

        return (
          <line
            key={i}
            x1={b.x + k}
            y1={b.y}
            x2={b.x + k + b.h}
            y2={b.y + b.h}
            stroke="currentColor"
            strokeWidth={HATCH_WIDTH}
          />
        );
      })}
    </g>
  );
}

/** The visible element(s) for one annotation, drawn in `currentColor` (set per shape from its colour). */
function shape(annotation: Annotation): JSX.Element | null {
  const w = annotation.width;

  switch (annotation.kind) {
    case "line": {
      const a = toSvgPoint(annotation.a);
      const b = toSvgPoint(annotation.b);

      return (
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="currentColor"
          strokeWidth={w}
          strokeLinecap="round"
          {...dashAttrs(annotation)}
        />
      );
    }
    case "arrow": {
      if (annotation.via) {
        const seg = curvedArrowSegment(annotation.from, annotation.to, annotation.via);

        if (!seg) return null;

        return (
          <>
            <path
              d={seg.path}
              fill="none"
              stroke="currentColor"
              strokeWidth={w}
              strokeLinecap="round"
              {...dashAttrs(annotation)}
            />
            <path d={seg.head} fill="currentColor" />
          </>
        );
      }

      const seg = arrowSegment(annotation.from, annotation.to, 0, 0);

      if (!seg) return null;

      return (
        <>
          <line
            x1={seg.line.x1}
            y1={seg.line.y1}
            x2={seg.line.x2}
            y2={seg.line.y2}
            stroke="currentColor"
            strokeWidth={w}
            strokeLinecap="round"
            {...dashAttrs(annotation)}
          />
          <path d={seg.head} fill="currentColor" />
        </>
      );
    }
    case "rect": {
      const b = box(annotation.a, annotation.b);

      return (
        <>
          {annotation.fill === "hachure" && (
            <Hachure box={b} clip={<rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6} />} />
          )}
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={6}
            stroke="currentColor"
            strokeWidth={w}
            {...fillAttrs(annotation.fill)}
            {...dashAttrs(annotation)}
          />
        </>
      );
    }
    case "ellipse": {
      const { x, y, w: bw, h } = box(annotation.a, annotation.b);

      return (
        <>
          {annotation.fill === "hachure" && (
            <Hachure
              box={{ x, y, w: bw, h }}
              clip={<ellipse cx={x + bw / 2} cy={y + h / 2} rx={bw / 2} ry={h / 2} />}
            />
          )}
          <ellipse
            cx={x + bw / 2}
            cy={y + h / 2}
            rx={bw / 2}
            ry={h / 2}
            stroke="currentColor"
            strokeWidth={w}
            {...fillAttrs(annotation.fill)}
            {...dashAttrs(annotation)}
          />
        </>
      );
    }
    case "polygon": {
      const points = polygonPoints(annotation.points);

      return (
        <>
          {annotation.fill === "hachure" && (
            <Hachure box={pointsBox(annotation.points)} clip={<polygon points={points} />} />
          )}
          <polygon
            points={points}
            stroke="currentColor"
            strokeWidth={w}
            strokeLinejoin="round"
            {...fillAttrs(annotation.fill)}
            {...dashAttrs(annotation)}
          />
        </>
      );
    }
    case "free":
      return (
        <path
          d={freehandPath(annotation.points)}
          fill="none"
          stroke="currentColor"
          strokeWidth={w}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "text": {
      const { x, y } = toSvgPoint(annotation.at);

      return (
        <text className="court-annotation-text" x={x} y={y} fontSize={textSize(w)}>
          {annotation.text}
        </text>
      );
    }
  }
}

/** A wide invisible target so the shape is grabbable even where it is thin (the select tool). */
function hit(annotation: Annotation, onPointerDown: (id: string, event: PointerEvent) => void): JSX.Element {
  const common = {
    className: "court-annotation-hit",
    onPointerDown: (event: PointerEvent) => onPointerDown(annotation.id, event),
  };

  switch (annotation.kind) {
    case "line":
    case "arrow": {
      // A bent arrow's target follows its curve; a straight hit line would miss the bow.
      const seg =
        annotation.kind === "arrow" && annotation.via
          ? curvedArrowSegment(annotation.from, annotation.to, annotation.via)
          : null;

      if (seg) {
        return (
          <path
            {...common}
            className={`${common.className} court-annotation-hit--stroke`}
            d={seg.path}
            fill="none"
            stroke="transparent"
            strokeWidth={HIT_WIDTH}
          />
        );
      }

      const a = toSvgPoint(annotation.kind === "line" ? annotation.a : annotation.from);
      const b = toSvgPoint(annotation.kind === "line" ? annotation.b : annotation.to);

      return <line {...common} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={HIT_WIDTH} />;
    }
    // A wide transparent stroke over the same path, so the target follows the stroke rather than
    // over-capturing its bounding box (the stroke-only modifier keeps the implied fill region inert).
    case "free":
      return (
        <path
          {...common}
          className={`${common.className} court-annotation-hit--stroke`}
          d={freehandPath(annotation.points)}
          fill="none"
          stroke="transparent"
          strokeWidth={HIT_WIDTH}
        />
      );
    case "text": {
      const { x, y, w, h } = textBox(annotation);

      return <rect {...common} x={x} y={y} width={w} height={h} fill="transparent" />;
    }
    // The filled polygon area is the target, whatever the fill style shows.
    case "polygon":
      return <polygon {...common} points={polygonPoints(annotation.points)} fill="transparent" />;
    default: {
      const { x, y, w, h } = box(annotation.a, annotation.b);

      return <rect {...common} x={x} y={y} width={w} height={h} fill="transparent" />;
    }
  }
}

type AnnotationsProps = {
  annotations: readonly Annotation[];
  /** A shape being drawn right now, previewed above the committed ones. */
  draft?: Annotation | null;
  /** The selected annotation's id (editor only), highlighted with an accent glow. */
  selectedId?: string | null;
  /** When set, each shape carries a hit target that selects and starts a move on press (select tool). */
  onShapePointerDown?: (id: string, event: PointerEvent) => void;
  /** When set, the selected shape shows reshape handles that start a handle drag on press. */
  onHandlePointerDown?: (id: string, handle: AnnotationHandle, event: PointerEvent) => void;
};

function AnnotationItem({
  annotation,
  selected,
  onShapePointerDown,
}: {
  annotation: Annotation;
  selected: boolean;
  onShapePointerDown?: (id: string, event: PointerEvent) => void;
}): JSX.Element {
  return (
    <g
      className={`court-annotation${selected ? " court-annotation--selected" : ""}`}
      style={{ color: MARKER_COLORS[annotation.color].fill }}
    >
      {shape(annotation)}
      {onShapePointerDown && hit(annotation, onShapePointerDown)}
    </g>
  );
}

export function Annotations({
  annotations,
  draft,
  selectedId,
  onShapePointerDown,
  onHandlePointerDown,
}: AnnotationsProps): JSX.Element {
  const selected = annotations.find((a) => a.id === selectedId);

  return (
    <g className={`court-annotations${onShapePointerDown ? " court-annotations--select" : ""}`} aria-hidden="true">
      {annotations.map((annotation) => (
        <AnnotationItem
          key={annotation.id}
          annotation={annotation}
          selected={annotation.id === selectedId}
          onShapePointerDown={onShapePointerDown}
        />
      ))}
      {draft && (
        <g className="court-annotation court-annotation--draft" style={{ color: MARKER_COLORS[draft.color].fill }}>
          {shape(draft)}
        </g>
      )}
      {selected && onHandlePointerDown && (
        <AnnotationHandles annotation={selected} onHandlePointerDown={onHandlePointerDown} />
      )}
    </g>
  );
}
