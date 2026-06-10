import type { JSX, PointerEvent } from "react";

import type { AnnotationHandle } from "../boards/operations";
import { annotationHandles } from "../boards/operations";
import { toSvgPoint } from "./geometry";
import type { Annotation } from "./types";

// The reshape handles over the selected annotation (select tool only): an accent-ringed dot per
// endpoint or box corner, each backed by a generous invisible hit circle. `data-handle` lets the
// stylesheet pick the right resize cursor per corner.

const HANDLE_R = 11;
const HIT_R = 26;

type AnnotationHandlesProps = {
  annotation: Annotation;
  onHandlePointerDown: (id: string, handle: AnnotationHandle, event: PointerEvent) => void;
};

export function AnnotationHandles({ annotation, onHandlePointerDown }: AnnotationHandlesProps): JSX.Element {
  return (
    <g className="court-annotation-handles">
      {annotationHandles(annotation).map(({ handle, point }) => {
        const { x, y } = toSvgPoint(point);

        return (
          <g key={handle} className="court-annotation-handle" data-handle={handle}>
            <circle className="court-annotation-handle-dot" cx={x} cy={y} r={HANDLE_R} />
            <circle
              className="court-annotation-handle-hit"
              data-handle={handle}
              cx={x}
              cy={y}
              r={HIT_R}
              onPointerDown={(event) => onHandlePointerDown(annotation.id, handle, event)}
            />
          </g>
        );
      })}
    </g>
  );
}
