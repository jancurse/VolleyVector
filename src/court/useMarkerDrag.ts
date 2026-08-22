import { useCallback, useState } from "react";
import type { PointerEvent, RefObject } from "react";

import { clampMarker, fromSvgPoint } from "./geometry";
import type { NormalizedPoint } from "./geometry";
import type { Marker } from "./types";

// Pointer dragging for markers. The court's <svg> captures the pointer on marker press, so a drag
// keeps tracking even when it leaves the court; client coordinates are mapped back through the
// SVG's screen matrix into the normalized space the rest of the app speaks.

export type MarkerDrag = {
  draggingId: string | null;
  onMarkerPointerDown: (id: string, event: PointerEvent) => void;
  onSurfacePointerDown: () => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: () => void;
};

/** Map a client (screen) coordinate back to the court's normalized space through the SVG's on-screen
 *  matrix, so a pointer maps exactly however the court is sized. Shared by marker drag and annotation
 *  drawing. Returns null when the matrix is unavailable (e.g. the element is not laid out yet). */
export function clientToNormalized(svg: SVGSVGElement, clientX: number, clientY: number): NormalizedPoint | null {
  const ctm = svg.getScreenCTM();

  if (!ctm) return null;

  const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());

  return fromSvgPoint({ x: point.x, y: point.y });
}

const identity = (position: NormalizedPoint): NormalizedPoint => position;

export function useMarkerDrag(
  svgRef: RefObject<SVGSVGElement | null>,
  markers: readonly Marker[],
  onSelect: (id: string | null) => void,
  onMove: (id: string, position: NormalizedPoint) => void,
  snap: (position: NormalizedPoint) => NormalizedPoint = identity,
  opponentSide = false
): MarkerDrag {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const onMarkerPointerDown = useCallback(
    (id: string, event: PointerEvent) => {
      event.stopPropagation();
      onSelect(id);
      setDraggingId(id);
      svgRef.current?.setPointerCapture(event.pointerId);
    },
    [onSelect, svgRef]
  );

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (draggingId === null || !svgRef.current) return;

      const position = clientToNormalized(svgRef.current, event.clientX, event.clientY);
      const dragged = markers.find((m) => m.id === draggingId);

      if (position && dragged) onMove(draggingId, snap(clampMarker(position, opponentSide, dragged)));
    },
    [draggingId, markers, onMove, snap, svgRef, opponentSide]
  );

  return {
    draggingId,
    onMarkerPointerDown,
    onSurfacePointerDown: useCallback(() => onSelect(null), [onSelect]),
    onPointerMove,
    onPointerUp: useCallback(() => setDraggingId(null), []),
  };
}
