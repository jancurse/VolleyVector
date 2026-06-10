import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent, RefObject } from "react";

import type { AnnotationHandle } from "../boards/operations";
import { simplifyStroke } from "./freehand";
import { clampToCourt } from "./geometry";
import type { NormalizedPoint } from "./geometry";
import type { SnapResult } from "./snapping";
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
  /** Move one handle of a shape (the select tool's reshape drag). */
  onReshape?: (id: string, handle: AnnotationHandle, point: NormalizedPoint) => void;
  /** Magnetic snapping applied to drawn and reshaped points. Holding Alt bypasses it. */
  snapPoint?: (point: NormalizedPoint) => SnapResult;
};

export type AnnotationDraw = {
  /** The shape being drawn right now, for a live preview, or null when idle. */
  draft: Annotation | null;
  /** Where the current point locked onto a snap target, for the court's snap indicator. */
  snapTarget: NormalizedPoint | null;
  onSurfacePointerDown: (event: PointerEvent) => void;
  onShapePointerDown: (id: string, event: PointerEvent) => void;
  onHandlePointerDown: (id: string, handle: AnnotationHandle, event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: () => void;
};

// The shape kinds a press-drag-release gesture draws; `text` instead places on a single click.
type DragKind = Exclude<AnnotationKind, "text">;

type Gesture =
  | { type: "draw"; kind: DragKind; start: NormalizedPoint; current: NormalizedPoint; points: NormalizedPoint[] }
  | { type: "move"; id: string; last: NormalizedPoint }
  | { type: "reshape"; id: string; handle: AnnotationHandle };

function newId(): string {
  return crypto.randomUUID();
}

/** Build a two-corner shape (or arrow) of `kind` from corners `a`/`b`. Freehand and text are built
 *  separately. */
function makeShape(
  id: string,
  kind: Exclude<AnnotationKind, "free" | "text">,
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
  const { tool, style, onDraw, onSelect, onTranslate, onReshape, snapPoint } = options;
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [snapTarget, setSnapTarget] = useState<NormalizedPoint | null>(null);
  const gesture = useRef<Gesture | null>(null);

  const isDrawTool = tool !== "markers" && tool !== "select";

  // Clamp and snap one drawn/reshaped point. Freehand and whole-shape moves stay smooth (no snap),
  // and Alt bypasses the magnet for precise placement.
  const applySnap = useCallback(
    (point: NormalizedPoint, event: PointerEvent): SnapResult => {
      const clamped = clampToCourt(point);

      return snapPoint && !event.altKey ? snapPoint(clamped) : { point: clamped, target: null };
    },
    [snapPoint]
  );

  // Escape cancels an in-progress draw: the capturing window listener runs (and preventDefaults)
  // before the editor's document-level shortcuts, so the same press never also deselects.
  useEffect(() => {
    if (!draft) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;

      event.preventDefault();
      gesture.current = null;
      setDraft(null);
      setSnapTarget(null);
    };

    window.addEventListener("keydown", onKeyDown, true);

    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [draft]);

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

      // A text label places on the click itself — no drag, no draft; the editor opens it for typing.
      // preventDefault keeps the press from re-focusing the court frame, which would blur (and so
      // discard) the label's freshly focused inline editor.
      if (tool === "text") {
        event.preventDefault();
        onDraw({ id: newId(), kind: "text", at: applySnap(point, event).point, text: "", ...style });

        return;
      }

      const free = tool === "free";
      const { point: start, target } = free ? { point: clampToCourt(point), target: null } : applySnap(point, event);

      svg.setPointerCapture(event.pointerId);
      gesture.current = { type: "draw", kind: tool, start, current: start, points: [start] };
      setSnapTarget(target);
      setDraft(
        free
          ? { id: DRAFT_ID, kind: "free", points: [start], ...style }
          : makeShape(DRAFT_ID, tool, style, start, start)
      );
    },
    [svgRef, tool, isDrawTool, onSelect, onDraw, style, applySnap]
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

  const onHandlePointerDown = useCallback(
    (id: string, handle: AnnotationHandle, event: PointerEvent) => {
      event.stopPropagation();
      if (tool !== "select") return;

      svgRef.current?.setPointerCapture(event.pointerId);
      gesture.current = { type: "reshape", id, handle };
    },
    [svgRef, tool]
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

      if (g.type === "reshape") {
        const { point: p, target } = applySnap(point, event);

        setSnapTarget(target);
        onReshape?.(g.id, g.handle, p);

        return;
      }

      if (g.kind === "free") {
        g.current = clampToCourt(point);
        g.points.push(g.current);
        setDraft({ id: DRAFT_ID, kind: "free", points: [...g.points], ...style });
      } else {
        const { point: p, target } = applySnap(point, event);

        g.current = p;
        setSnapTarget(target);
        setDraft(makeShape(DRAFT_ID, g.kind, style, g.start, g.current));
      }
    },
    [svgRef, onTranslate, onReshape, style, applySnap]
  );

  const onPointerUp = useCallback(() => {
    const g = gesture.current;

    gesture.current = null;
    setDraft(null);
    setSnapTarget(null);
    if (!g || g.type !== "draw") return;

    if (g.kind === "free") {
      const points = simplifyStroke(g.points);

      if (points.length >= 2) onDraw({ id: newId(), kind: "free", points, ...style });

      return;
    }

    if (Math.hypot(g.current.x - g.start.x, g.current.y - g.start.y) < MIN_SPAN) return;

    onDraw(makeShape(newId(), g.kind, style, g.start, g.current));
  }, [onDraw, style]);

  return {
    draft,
    snapTarget,
    onSurfacePointerDown,
    onShapePointerDown,
    onHandlePointerDown,
    onPointerMove,
    onPointerUp,
  };
}
