import type { JSX, PointerEvent } from "react";

import { arrowSegment } from "./Arrows";
import { freehandPath } from "./freehand";
import { toSvgPoint } from "./geometry";
import type { NormalizedPoint } from "./geometry";
import { MARKER_COLORS } from "./roles";
import type { Annotation } from "./types";

// The drawn-annotation layer, sibling to Arrows. It maps each per-step annotation to one themed SVG
// element coloured from the marker palette, and (in the editor's select tool) gives each a wide
// invisible hit target so even a thin line is grabbable. The whole layer is non-interactive by default
// (pointer-events off), so it never blocks marker dragging or a surface deselect; the hit targets
// switch interaction back on only when selecting is active.

// Half-extent of a line/arrow's invisible hit target, in SVG units — wide enough to grab a thin line.
const HIT_WIDTH = 30;

/** The min-corner and size of a two-corner shape in SVG space (so `a`/`b` may be given in any order). */
function box(a: NormalizedPoint, b: NormalizedPoint): { x: number; y: number; w: number; h: number } {
  const p = toSvgPoint(a);
  const q = toSvgPoint(b);

  return { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), w: Math.abs(q.x - p.x), h: Math.abs(q.y - p.y) };
}

/** The visible element(s) for one annotation, drawn in `currentColor` (set per shape from its colour). */
function shape(annotation: Annotation): JSX.Element | null {
  const w = annotation.width;

  switch (annotation.kind) {
    case "line": {
      const a = toSvgPoint(annotation.a);
      const b = toSvgPoint(annotation.b);

      return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor" strokeWidth={w} strokeLinecap="round" />;
    }
    case "arrow": {
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
          />
          <path d={seg.head} fill="currentColor" />
        </>
      );
    }
    case "rect": {
      const { x, y, w: bw, h } = box(annotation.a, annotation.b);

      return <rect x={x} y={y} width={bw} height={h} fill="none" stroke="currentColor" strokeWidth={w} rx={6} />;
    }
    case "area": {
      const { x, y, w: bw, h } = box(annotation.a, annotation.b);

      return (
        <ellipse
          cx={x + bw / 2}
          cy={y + h / 2}
          rx={bw / 2}
          ry={h / 2}
          fill="currentColor"
          fillOpacity={0.16}
          stroke="currentColor"
          strokeWidth={w}
        />
      );
    }
    case "free":
      return <path d={freehandPath(annotation.points, w)} fill="currentColor" />;
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
      const a = toSvgPoint(annotation.kind === "line" ? annotation.a : annotation.from);
      const b = toSvgPoint(annotation.kind === "line" ? annotation.b : annotation.to);

      return <line {...common} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={HIT_WIDTH} />;
    }
    case "free": {
      const xs = annotation.points.map((p) => toSvgPoint(p));
      const minX = Math.min(...xs.map((p) => p.x));
      const minY = Math.min(...xs.map((p) => p.y));
      const maxX = Math.max(...xs.map((p) => p.x));
      const maxY = Math.max(...xs.map((p) => p.y));

      return <rect {...common} x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill="transparent" />;
    }
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

export function Annotations({ annotations, draft, selectedId, onShapePointerDown }: AnnotationsProps): JSX.Element {
  return (
    <g className="court-annotations" aria-hidden="true">
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
    </g>
  );
}
