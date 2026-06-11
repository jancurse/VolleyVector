import type { NormalizedPoint } from "../court/geometry";
import type { Annotation, AnnotationFill, AnnotationStyle } from "../court/types";
import type { BoardStep } from "./types";

// Read-time normalization of stored annotations, so legacy rows load as the current model with no
// migration: the retired `area` kind was a tinted ellipse, and closed shapes predating fills carried
// no fill field. A board rewrites itself to the new shape on its next save.

type StoredBox = { id: string; a: NormalizedPoint; b: NormalizedPoint } & AnnotationStyle;

/** An annotation as an older row may carry it: the retired `area` kind, or a closed shape without a fill. */
export type StoredAnnotation =
  | Annotation
  | (StoredBox & { kind: "area" })
  | (StoredBox & { kind: "rect"; fill?: AnnotationFill })
  | (StoredBox & { kind: "ellipse"; fill?: AnnotationFill });

/** A stored step, whose annotations may predate the current model. */
export type StoredStep = Omit<BoardStep, "annotations"> & { annotations?: StoredAnnotation[] };

/** Map one stored annotation to the current model; a modern shape passes through untouched. */
export function normalizeAnnotation(annotation: StoredAnnotation): Annotation {
  switch (annotation.kind) {
    case "area": {
      const { kind: _retired, ...rest } = annotation;

      return { ...rest, kind: "ellipse", fill: "tint" };
    }
    case "rect":
      return { ...annotation, fill: annotation.fill ?? "none" };
    case "ellipse":
      return { ...annotation, fill: annotation.fill ?? "none" };
    default:
      return annotation;
  }
}

/** Normalize every step's annotations on read; a step without any passes through untouched. */
export function normalizeSteps(steps: readonly StoredStep[]): BoardStep[] {
  return steps.map(({ annotations, ...step }) =>
    annotations ? { ...step, annotations: annotations.map(normalizeAnnotation) } : step
  );
}
