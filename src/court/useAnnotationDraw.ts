import { useCallback, useRef, useState } from "react";
import type { PointerEvent, RefObject } from "react";

import { simplifyStroke } from "./freehand";
import { clampToCourt } from "./geometry";
import type { NormalizedPoint } from "./geometry";
import type { Annotation, AnnotationKind, AnnotationStyle, AnnotationTool } from "./types";
import { clientToNormalized } from "./useMarkerDrag";

// Pointer interaction for the annotation tools, the sibling of useMarkerDrag. When a drawing tool is
// active it owns the surface gesture: press-drag-release builds an in-progress draft shape (previewed
// live) and commits it on release. The `select` tool instead hit-tests shapes — a press selects one
// and drags it bodily, translating its points by the pointer delta. It reuses the same exact
// client→normalized mapping as marker dragging, so both speak the court's normalized coordinates.

// A shape smaller than this (normalized) on release is treated as a stray click and discarded.
const MIN_SPAN = 0.02;

// The id the live draft carries; it never reaches a board, where each committed shape gets a fresh id.
const DRAFT_ID = "__draft__";

type Options = {
  tool: AnnotationTool;
  style: AnnotationStyle;
  onDraw: (annotation: Annotation) => void;
  onSelect: (id: string | null) => void;
  onTranslate: (id: string, dx: number, dy: number) => void;
};

export type AnnotationDraw = {
  /** The shape being drawn right now, for a live preview, or null when idle. */
  draft: Annotation | null;
  onSurfacePointerDown: (event: PointerEvent) => void;
  onShapePointerDown: (id: string, event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: () => void;
};

type Gesture =
  | { type: "draw"; kind: AnnotationKind; start: NormalizedPoint; current: NormalizedPoint; points: NormalizedPoint[] }
  | { type: "move"; id: string; last: NormalizedPoint };

function newId(): string {
  return crypto.randomUUID();
}

/** Build a two-corner shape (or arrow) of `kind` from corners `a`/`b`. Freehand is built separately. */
function makeShape(
  id: string,
  kind: Exclude<AnnotationKind, "free">,
  style: AnnotationStyle,
  a: NormalizedPoint,
  b: NormalizedPoint
): Annotation {
  switch (kind) {
    case "arrow":
      return { id, kind: "arrow", from: a, to: b, ...style };
    case "line":
      return { id, kind: "line", a, b, ...style };
    case "rect":
      return { id, kind: "rect", a, b, ...style };
    case "area":
      return { id, kind: "area", a, b, ...style };
  }
}

export function useAnnotationDraw(svgRef: RefObject<SVGSVGElement | null>, options: Options): AnnotationDraw {
  const { tool, style, onDraw, onSelect, onTranslate } = options;
  const [draft, setDraft] = useState<Annotation | null>(null);
  const gesture = useRef<Gesture | null>(null);

  const isDrawTool = tool !== "markers" && tool !== "select";

  const onSurfacePointerDown = useCallback(
    (event: PointerEvent) => {
      const svg = svgRef.current;

      if (!svg) return;

      if (tool === "select") {
        onSelect(null);

        return;
      }

      if (!isDrawTool) return;

      const point = clientToNormalized(svg, event.clientX, event.clientY);

      if (!point) return;

      const start = clampToCourt(point);

      svg.setPointerCapture(event.pointerId);
      gesture.current = { type: "draw", kind: tool, start, current: start, points: [start] };
      setDraft(
        tool === "free"
          ? { id: DRAFT_ID, kind: "free", points: [start], ...style }
          : makeShape(DRAFT_ID, tool, style, start, start)
      );
    },
    [svgRef, tool, isDrawTool, onSelect, style]
  );

  const onShapePointerDown = useCallback(
    (id: string, event: PointerEvent) => {
      event.stopPropagation();
      if (tool !== "select") return;

      const svg = svgRef.current;

      onSelect(id);
      if (!svg) return;

      const point = clientToNormalized(svg, event.clientX, event.clientY);

      if (!point) return;

      svg.setPointerCapture(event.pointerId);
      gesture.current = { type: "move", id, last: point };
    },
    [svgRef, tool, onSelect]
  );

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const g = gesture.current;
      const svg = svgRef.current;

      if (!g || !svg) return;

      const point = clientToNormalized(svg, event.clientX, event.clientY);

      if (!point) return;

      if (g.type === "move") {
        onTranslate(g.id, point.x - g.last.x, point.y - g.last.y);
        g.last = point;

        return;
      }

      g.current = clampToCourt(point);
      if (g.kind === "free") {
        g.points.push(g.current);
        setDraft({ id: DRAFT_ID, kind: "free", points: [...g.points], ...style });
      } else {
        setDraft(makeShape(DRAFT_ID, g.kind, style, g.start, g.current));
      }
    },
    [svgRef, onTranslate, style]
  );

  const onPointerUp = useCallback(() => {
    const g = gesture.current;

    gesture.current = null;
    setDraft(null);
    if (!g || g.type !== "draw") return;

    if (g.kind === "free") {
      const points = simplifyStroke(g.points);

      if (points.length >= 2) onDraw({ id: newId(), kind: "free", points, ...style });

      return;
    }

    if (Math.hypot(g.current.x - g.start.x, g.current.y - g.start.y) < MIN_SPAN) return;

    onDraw(makeShape(newId(), g.kind, style, g.start, g.current));
  }, [onDraw, style]);

  return { draft, onSurfacePointerDown, onShapePointerDown, onPointerMove, onPointerUp };
}
