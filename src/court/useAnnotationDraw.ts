import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent, RefObject } from "react";

import type { AnnotationHandle } from "../boards/operations";
import { simplifyStroke } from "./freehand";
import { clampToCourt } from "./geometry";
import type { NormalizedPoint } from "./geometry";
import type { SnapResult } from "./snapping";
import type { Annotation, AnnotationKind, AnnotationStyle, AnnotationTool, NewAnnotationStyle } from "./types";
import { clientToNormalized } from "./useMarkerDrag";

// Pointer interaction for the annotation tools, the sibling of useMarkerDrag. When a drawing tool is
// active it owns the surface gesture: press-drag-release builds an in-progress draft shape (previewed
// live) and commits it on release. The polygon tool is the one multi-click gesture: each click adds a
// vertex (rubber-banded to the cursor), and clicking the first vertex, double-clicking, or Enter
// closes the shape. The `select` tool instead hit-tests shapes — a press selects one and drags it
// bodily, translating its points by the pointer delta. It reuses the same exact client→normalized
// mapping as marker dragging, so both speak the court's normalized coordinates.

// A shape smaller than this (normalized) on release is treated as a stray click and discarded.
const MIN_SPAN = 0.02;

// A freehand sample closer than this (normalized) to the previous one is skipped: the pointer is
// otherwise tracked unsmoothed, and this floor only keeps standstill jitter out of the stored points.
const MIN_SAMPLE = 0.004;

// A polygon click this close (normalized) to the first or last vertex closes the shape instead of
// adding one. Closing on the last vertex also makes a double-click close: its second press lands on
// the vertex the first press placed (browser click counting is unreliable on pointer events).
const CLOSE_RADIUS = 0.03;

// The id the live draft carries; it never reaches a board, where each committed shape gets a fresh id.
const DRAFT_ID = "__draft__";

type Options = {
  tool: AnnotationTool;
  style: NewAnnotationStyle;
  onDraw: (annotation: Annotation) => void;
  onSelect: (id: string | null) => void;
  onTranslate: (id: string, dx: number, dy: number) => void;
  /** Move one handle of a shape (the select tool's reshape drag). */
  onReshape?: (id: string, handle: AnnotationHandle, point: NormalizedPoint) => void;
  /** Magnetic snapping applied to drawn and reshaped points. Holding Alt bypasses it. */
  snapPoint?: (point: NormalizedPoint) => SnapResult;
};

/** A vertex of the in-progress polygon that a click would close on; `hot` when the cursor is in range. */
export type CloseTarget = { point: NormalizedPoint; hot: boolean };

export type AnnotationDraw = {
  /** The shape being drawn right now, for a live preview, or null when idle. */
  draft: Annotation | null;
  /** Where the current point locked onto a snap target, for the court's snap indicator. */
  snapTarget: NormalizedPoint | null;
  /** The in-progress polygon's close targets (first and last vertex), for the court's finish cues. */
  closeTargets: CloseTarget[] | null;
  onSurfacePointerDown: (event: PointerEvent) => void;
  onShapePointerDown: (id: string, event: PointerEvent) => void;
  onHandlePointerDown: (id: string, handle: AnnotationHandle, event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: () => void;
};

// The shape kinds a press-drag-release gesture draws; `text` places on a single click and `polygon`
// builds vertex by vertex (the `poly` gesture, which outlives each press).
type DragKind = Exclude<AnnotationKind, "text" | "polygon">;

type Gesture =
  | { type: "draw"; kind: DragKind; start: NormalizedPoint; current: NormalizedPoint; points: NormalizedPoint[] }
  | { type: "poly"; points: NormalizedPoint[] }
  | { type: "move"; id: string; last: NormalizedPoint }
  | { type: "reshape"; id: string; handle: AnnotationHandle };

function newId(): string {
  return crypto.randomUUID();
}

/** The shared stroke style (colour, width) without the closed-shape fill or the stroked-shape dash. */
function strokeOf(style: NewAnnotationStyle): AnnotationStyle {
  const { fill: _fill, dash: _dash, ...stroke } = style;

  return stroke;
}

/** Build a two-corner shape (or arrow) of `kind` from corners `a`/`b`. Polygon, freehand, and text are
 *  built separately; only the closed kinds carry the style's fill, and all four carry its dash. */
function makeShape(
  id: string,
  kind: Exclude<AnnotationKind, "free" | "text" | "polygon">,
  style: NewAnnotationStyle,
  a: NormalizedPoint,
  b: NormalizedPoint
): Annotation {
  const { fill, ...stroke } = style;

  switch (kind) {
    case "arrow":
      return { id, kind: "arrow", from: a, to: b, ...stroke };
    case "line":
      return { id, kind: "line", a, b, ...stroke };
    case "rect":
      return { id, kind: "rect", a, b, fill, ...stroke };
    case "ellipse":
      return { id, kind: "ellipse", a, b, fill, ...stroke };
  }
}

/** The in-progress polygon's first and last placed vertex, hot when `cursor` is in closing range
 *  (only once 3 vertices exist, since closing earlier would discard the shape). */
function closeTargetsFor(points: readonly NormalizedPoint[], cursor: NormalizedPoint): CloseTarget[] {
  const targets = points.length > 1 ? [points[0], points[points.length - 1]] : [points[0]];

  return targets.map((point) => ({
    point,
    hot: points.length >= 3 && Math.hypot(cursor.x - point.x, cursor.y - point.y) < CLOSE_RADIUS,
  }));
}

export function useAnnotationDraw(svgRef: RefObject<SVGSVGElement | null>, options: Options): AnnotationDraw {
  const { tool, style, onDraw, onSelect, onTranslate, onReshape, snapPoint } = options;
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [snapTarget, setSnapTarget] = useState<NormalizedPoint | null>(null);
  const [closeTargets, setCloseTargets] = useState<CloseTarget[] | null>(null);
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

  // Close the polygon gesture: clear it, and commit the shape unless it never reached 3 vertices.
  const commitPolygon = useCallback(
    (points: NormalizedPoint[]) => {
      gesture.current = null;
      setDraft(null);
      setSnapTarget(null);
      setCloseTargets(null);
      if (points.length >= 3) onDraw({ id: newId(), kind: "polygon", points, ...style });
    },
    [onDraw, style]
  );

  // Escape cancels an in-progress draw, and Enter closes an in-progress polygon: the capturing window
  // listener runs (and preventDefaults) before the editor's document-level shortcuts, so the same
  // press never also deselects.
  useEffect(() => {
    if (!draft) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        gesture.current = null;
        setDraft(null);
        setSnapTarget(null);
        setCloseTargets(null);
      } else if (event.key === "Enter" && gesture.current?.type === "poly") {
        event.preventDefault();
        commitPolygon(gesture.current.points);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);

    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [draft, commitPolygon]);

  // Switching tool mid-polygon abandons the gesture: the draft hides at once (its kind no longer
  // matches the tool, below) and the next surface interaction discards the leftover gesture state.
  const dropStalePolygon = useCallback(() => {
    if (gesture.current?.type !== "poly" || tool === "polygon") return;

    gesture.current = null;
    setDraft(null);
    setSnapTarget(null);
    setCloseTargets(null);
  }, [tool]);

  const onSurfacePointerDown = useCallback(
    (event: PointerEvent) => {
      dropStalePolygon();

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
        onDraw({ id: newId(), kind: "text", at: applySnap(point, event).point, text: "", ...strokeOf(style) });

        return;
      }

      // The polygon's multi-click gesture: each press adds a vertex; once 3 exist, a press on the
      // first or last vertex closes the shape. No pointer capture — the gesture spans many presses.
      if (tool === "polygon") {
        const { point: p, target } = applySnap(point, event);
        const g = gesture.current;

        if (g?.type !== "poly") {
          gesture.current = { type: "poly", points: [p] };
          setSnapTarget(target);
          setCloseTargets(closeTargetsFor([p], p));
          setDraft({ id: DRAFT_ID, kind: "polygon", points: [p], ...style });

          return;
        }

        if (closeTargetsFor(g.points, p).some((t) => t.hot)) {
          commitPolygon(g.points);

          return;
        }

        g.points.push(p);
        setSnapTarget(target);
        setCloseTargets(closeTargetsFor(g.points, p));
        setDraft({ id: DRAFT_ID, kind: "polygon", points: [...g.points], ...style });

        return;
      }

      const free = tool === "free";
      const { point: start, target } = free ? { point: clampToCourt(point), target: null } : applySnap(point, event);

      svg.setPointerCapture(event.pointerId);
      gesture.current = { type: "draw", kind: tool, start, current: start, points: [start] };
      setSnapTarget(target);
      setDraft(
        free
          ? { id: DRAFT_ID, kind: "free", points: [start], ...strokeOf(style) }
          : makeShape(DRAFT_ID, tool, style, start, start)
      );
    },
    [svgRef, tool, isDrawTool, onSelect, onDraw, style, applySnap, commitPolygon, dropStalePolygon]
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
      dropStalePolygon();

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

      // The polygon's rubber band: the draft previews the placed vertices plus the (snapped) cursor,
      // and the close targets warm up as the cursor enters closing range.
      if (g.type === "poly") {
        const { point: p, target } = applySnap(point, event);

        setSnapTarget(target);
        setCloseTargets(closeTargetsFor(g.points, p));
        setDraft({ id: DRAFT_ID, kind: "polygon", points: [...g.points, p], ...style });

        return;
      }

      if (g.kind === "free") {
        const p = clampToCourt(point);
        const last = g.points[g.points.length - 1];

        if (Math.hypot(p.x - last.x, p.y - last.y) < MIN_SAMPLE) return;

        g.current = p;
        g.points.push(p);
        setDraft({ id: DRAFT_ID, kind: "free", points: [...g.points], ...strokeOf(style) });
      } else {
        const { point: p, target } = applySnap(point, event);

        g.current = p;
        setSnapTarget(target);
        setDraft(makeShape(DRAFT_ID, g.kind, style, g.start, g.current));
      }
    },
    [svgRef, onTranslate, onReshape, style, applySnap, dropStalePolygon]
  );

  const onPointerUp = useCallback(() => {
    const g = gesture.current;

    // A polygon gesture outlives each press; only its close (or Escape) ends it.
    if (g?.type === "poly") return;

    gesture.current = null;
    setDraft(null);
    setSnapTarget(null);
    if (!g || g.type !== "draw") return;

    if (g.kind === "free") {
      const points = simplifyStroke(g.points);

      if (points.length >= 2) onDraw({ id: newId(), kind: "free", points, ...strokeOf(style) });

      return;
    }

    if (Math.hypot(g.current.x - g.start.x, g.current.y - g.start.y) < MIN_SPAN) return;

    onDraw(makeShape(newId(), g.kind, style, g.start, g.current));
  }, [onDraw, style]);

  return {
    // Every draft kind matches the tool that draws it, so a mid-gesture tool switch hides the draft.
    draft: draft && draft.kind === tool ? draft : null,
    snapTarget,
    closeTargets: tool === "polygon" ? closeTargets : null,
    onSurfacePointerDown,
    onShapePointerDown,
    onHandlePointerDown,
    onPointerMove,
    onPointerUp,
  };
}
