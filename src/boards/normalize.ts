import type { NormalizedPoint } from "../court/geometry";
import { resolveColorKey } from "../court/roles";
import type { Annotation, AnnotationFill, AnnotationStyle } from "../court/types";
import type { BoardMarker, BoardStep } from "./types";

// Read-time normalization of stored content, so legacy rows load as the current model with no
// migration: the retired `area` kind was a tinted ellipse, closed shapes predating fills carried no
// fill field, and a marker or annotation may still store a retired colour key (red/green). A board
// rewrites itself to the new shape on its next save.

type StoredBox = { id: string; a: NormalizedPoint; b: NormalizedPoint } & AnnotationStyle;

/** An annotation as an older row may carry it: the retired `area` kind, or a closed shape without a fill. */
export type StoredAnnotation =
  | Annotation
  | (StoredBox & { kind: "area" })
  | (StoredBox & { kind: "rect"; fill?: AnnotationFill })
  | (StoredBox & { kind: "ellipse"; fill?: AnnotationFill });

/** A stored step, whose annotations may predate the current model. */
export type StoredStep = Omit<BoardStep, "annotations"> & { annotations?: StoredAnnotation[] };

/** Map one stored annotation to the current model, retired colour key remapped; a modern shape with a
 *  current colour passes through with only that colour resolved. */
export function normalizeAnnotation(annotation: StoredAnnotation): Annotation {
  const color = resolveColorKey(annotation.color) ?? annotation.color;

  switch (annotation.kind) {
    case "area": {
      const { kind: _retired, ...rest } = annotation;

      return { ...rest, color, kind: "ellipse", fill: "tint" };
    }
    case "rect":
      return { ...annotation, color, fill: annotation.fill ?? "none" };
    case "ellipse":
      return { ...annotation, color, fill: annotation.fill ?? "none" };
    default:
      return { ...annotation, color };
  }
}

/** Remap any retired colour key a marker still carries; a marker without one passes through untouched. */
export function normalizeMarkers(markers: readonly BoardMarker[]): BoardMarker[] {
  return markers.map((marker) => {
    const color = marker.color && resolveColorKey(marker.color);

    return color && color !== marker.color ? { ...marker, color } : marker;
  });
}

/** Normalize every step's annotations on read; a step without any passes through untouched. */
export function normalizeSteps(steps: readonly StoredStep[]): BoardStep[] {
  return steps.map(({ annotations, ...step }) =>
    annotations ? { ...step, annotations: annotations.map(normalizeAnnotation) } : step
  );
}
