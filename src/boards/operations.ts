import { clampToCourt } from "../court/geometry";
import type { NormalizedPoint } from "../court/geometry";
import type { CourtMode, MarkerRole } from "../court/roles";
import { ROLES } from "../court/roles";
import type { Marker } from "../court/types";
import type { Annotation, Board, BoardMarker, BoardStep } from "./types";

// Pure transforms over a board, its steps, and its markers. A position edit touches one step; an
// identity edit (role, label, colour, add, remove) spans every step, so a marker stays one identity
// throughout. Nothing here touches storage or the DOM.

// Roles that come in pairs (or more) on court and so always carry a number (OH1, MB1, P1); the rest
// stay unnumbered until a second one joins. This labelling convention is a Stage-2 placeholder.
const NUMBERED_ROLES: ReadonlySet<MarkerRole> = new Set(["outside", "middle", "coach", "player"]);

function newId(): string {
  return crypto.randomUUID();
}

/** The default label for a new marker of `role`, numbered to stay distinct from its siblings. */
export function nextLabel(role: MarkerRole, markers: readonly Marker[]): string | undefined {
  if (role === "ball") return undefined;

  const count = markers.filter((m) => m.role === role).length;
  const code = ROLES[role].code;

  return NUMBERED_ROLES.has(role) || count > 0 ? `${code}${count + 1}` : code;
}

// New markers land on a "bench" — a row in the free zone just below the end line — so they never
// pile up on the court. Each fills the leftmost free slot, reusing those vacated by markers already
// dragged onto the court.
const BENCH_Y = 1.07;
const BENCH_X0 = 0.1;
const BENCH_GAP = 0.11;
const BENCH_SLOTS = 8;

/** The leftmost free bench slot among `markers` — where a marker without a court position lands. */
export function benchPosition(markers: readonly Marker[]): NormalizedPoint {
  const taken = markers.filter((m) => m.position.y > 1).map((m) => m.position.x);

  for (let slot = 0; slot < BENCH_SLOTS; slot++) {
    const x = BENCH_X0 + slot * BENCH_GAP;

    if (!taken.some((tx) => Math.abs(tx - x) < BENCH_GAP / 2)) return { x, y: BENCH_Y };
  }

  return { x: BENCH_X0 + (markers.length % BENCH_SLOTS) * BENCH_GAP, y: BENCH_Y };
}

/** A new marker of `role`, labelled and placed on the bench below the court ready to be dragged on. */
export function makeMarker(role: MarkerRole, markers: readonly Marker[]): Marker {
  return {
    id: newId(),
    role,
    label: nextLabel(role, markers),
    position: benchPosition(markers),
  };
}

function makeStep(positions: Record<string, NormalizedPoint> = {}): BoardStep {
  return { id: newId(), instruction: "", positions };
}

/** A fresh single-step board — a Position — empty in the given mode, ready for the editor. */
export function createBoard(now: number, mode: CourtMode = "positions", title = "Untitled board"): Board {
  return {
    id: newId(),
    title,
    description: "",
    mode,
    markers: [],
    steps: [makeStep()],
    tags: [],
    createdBy: null,
    capability: "owner",
    currentRevisionId: null,
    autoArrows: true,
    rotationStrict: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** Step `index`'s markers as full `Marker`s (identity plus that step's position), ready for the Court. */
export function stepMarkers(board: Board, index: number): Marker[] {
  const step = board.steps[index];

  if (!step) return [];

  return board.markers.map((m) => ({ ...m, position: step.positions[m.id] }));
}

/** A marker's movement between two steps — the delta arrows are derived from and playback animates. */
export type MarkerMove = { id: string; from: NormalizedPoint; to: NormalizedPoint };

// Below this distance (normalized) a marker counts as stationary, so it draws no arrow.
const MOVE_EPSILON = 0.01;

/** Markers that move from step `index` to the next — derived purely from their position deltas. */
export function stepMoves(board: Board, index: number): MarkerMove[] {
  const from = board.steps[index];
  const to = board.steps[index + 1];

  if (!from || !to) return [];

  return board.markers
    .map((m) => ({ id: m.id, from: from.positions[m.id], to: to.positions[m.id] }))
    .filter(({ from: a, to: b }) => Math.hypot(b.x - a.x, b.y - a.y) > MOVE_EPSILON);
}

/** Insert a step after `afterIndex`, cloning that step's positions, annotations, and rotation so
 *  the diagram carries forward and only what changes needs editing. */
export function insertStep(board: Board, afterIndex: number): { board: Board; stepId: string } {
  const base = board.steps[afterIndex] ?? board.steps[board.steps.length - 1];
  const step = makeStep({ ...base.positions });

  if (base.annotations?.length) step.annotations = base.annotations.map((a) => ({ ...a }));
  if (base.rotation) step.rotation = base.rotation;

  const steps = [...board.steps];

  steps.splice(afterIndex + 1, 0, step);

  return { board: { ...board, steps }, stepId: step.id };
}

/** Reorder the step at `from` to index `to`. */
export function moveStep(board: Board, from: number, to: number): Board {
  if (from === to || to < 0 || to >= board.steps.length) return board;

  const steps = [...board.steps];
  const [moved] = steps.splice(from, 1);

  if (!moved) return board;

  steps.splice(to, 0, moved);

  return { ...board, steps };
}

/** Remove a step, always keeping at least one (so the board never drops below a Position). */
export function removeStep(board: Board, stepId: string): Board {
  if (board.steps.length <= 1) return board;

  return { ...board, steps: board.steps.filter((s) => s.id !== stepId) };
}

export function setStepInstruction(board: Board, stepId: string, instruction: string): Board {
  return { ...board, steps: board.steps.map((s) => (s.id === stepId ? { ...s, instruction } : s)) };
}

/** Move one marker on one step, leaving every other step's positions untouched. */
export function setStepPosition(board: Board, stepId: string, markerId: string, position: NormalizedPoint): Board {
  return {
    ...board,
    steps: board.steps.map((s) =>
      s.id === stepId ? { ...s, positions: { ...s.positions, [markerId]: position } } : s
    ),
  };
}

/** Add a marker to the board, benched on step `index` across every step, ready to be dragged on. */
export function addMarker(board: Board, role: MarkerRole, index: number): { board: Board; markerId: string } {
  const { position, ...identity } = makeMarker(role, stepMarkers(board, index));

  return {
    markerId: identity.id,
    board: {
      ...board,
      markers: [...board.markers, identity],
      steps: board.steps.map((s) => ({ ...s, positions: { ...s.positions, [identity.id]: position } })),
    },
  };
}

/** Patch a marker's shared identity (role, label, colour) across the whole board. */
export function setMarker(board: Board, markerId: string, patch: Partial<BoardMarker>): Board {
  return { ...board, markers: board.markers.map((m) => (m.id === markerId ? { ...m, ...patch } : m)) };
}

/** Remove a marker from the board entirely — its identity and its position on every step. */
export function removeMarker(board: Board, markerId: string): Board {
  return {
    ...board,
    markers: board.markers.filter((m) => m.id !== markerId),
    steps: board.steps.map(({ positions, ...s }) => {
      const { [markerId]: _removed, ...rest } = positions;

      return { ...s, positions: rest };
    }),
  };
}

// Annotations live on a single step (no cross-step identity), so every annotation edit targets one
// step by id, mirroring the position edits above. All point writes clamp to the court's reach.

/** Step `index`'s annotations (the drawings on it), or an empty list when it has none. */
export function stepAnnotations(board: Board, index: number): Annotation[] {
  return board.steps[index]?.annotations ?? [];
}

/** Rewrite a step's annotations through `next`, leaving every other step untouched. */
function withStepAnnotations(
  board: Board,
  stepId: string,
  next: (annotations: readonly Annotation[]) => Annotation[]
): Board {
  return {
    ...board,
    steps: board.steps.map((s) => (s.id === stepId ? { ...s, annotations: next(s.annotations ?? []) } : s)),
  };
}

/** Add a drawn annotation to one step. */
export function addAnnotation(board: Board, stepId: string, annotation: Annotation): Board {
  return withStepAnnotations(board, stepId, (annotations) => [...annotations, annotation]);
}

/** Patch one annotation on one step — its style (colour, width) or geometry. */
export function updateAnnotation(board: Board, stepId: string, id: string, patch: Partial<Annotation>): Board {
  return withStepAnnotations(board, stepId, (annotations) =>
    annotations.map((a) => (a.id === id ? ({ ...a, ...patch } as Annotation) : a))
  );
}

/** Remove one annotation from one step. */
export function removeAnnotation(board: Board, stepId: string, id: string): Board {
  return withStepAnnotations(board, stepId, (annotations) => annotations.filter((a) => a.id !== id));
}

const shiftPoint = (p: NormalizedPoint, dx: number, dy: number): NormalizedPoint =>
  clampToCourt({ x: p.x + dx, y: p.y + dy });

/** Shift every point of an annotation by a normalized delta — the whole-shape move. Clamped to court. */
export function translateAnnotation(annotation: Annotation, dx: number, dy: number): Annotation {
  switch (annotation.kind) {
    case "arrow":
      return {
        ...annotation,
        from: shiftPoint(annotation.from, dx, dy),
        to: shiftPoint(annotation.to, dx, dy),
        ...(annotation.via && { via: shiftPoint(annotation.via, dx, dy) }),
      };
    case "free":
    case "polygon":
      return { ...annotation, points: annotation.points.map((p) => shiftPoint(p, dx, dy)) };
    case "text":
      return { ...annotation, at: shiftPoint(annotation.at, dx, dy) };
    default:
      return { ...annotation, a: shiftPoint(annotation.a, dx, dy), b: shiftPoint(annotation.b, dx, dy) };
  }
}

// How far (normalized) a duplicated shape lands from its original, so the copy reads as a new shape.
const DUPLICATE_OFFSET = 0.03;

/** A copy of an annotation with a fresh id, offset slightly down-right (clamped to the court). */
export function duplicateAnnotation(annotation: Annotation): Annotation {
  return { ...translateAnnotation(annotation, DUPLICATE_OFFSET, DUPLICATE_OFFSET), id: newId() };
}

/** Append clones (fresh ids) of step `index`'s annotations to the next step. Appending never destroys
 *  drawings already on that step, and a stray copy stays one undo away. No-op on the last step. */
export function copyAnnotationsToNextStep(board: Board, index: number): Board {
  const from = board.steps[index];
  const to = board.steps[index + 1];

  if (!from?.annotations?.length || !to) return board;

  const clones = from.annotations.map((a) => ({ ...a, id: newId() }));

  return {
    ...board,
    steps: board.steps.map((s) => (s.id === to.id ? { ...s, annotations: [...(s.annotations ?? []), ...clones] } : s)),
  };
}

// Reshaping grabs one handle of a shape: a line/arrow exposes its two endpoints (an arrow also a
// `mid` handle that bends it), a rect/ellipse its four box corners (dragging one keeps the opposite
// corner anchored), a polygon one handle per vertex (`v0`, `v1`, …). Freehand offers no handles — it
// only translates as a whole.

export type AnnotationHandle = "start" | "end" | "mid" | "nw" | "ne" | "se" | "sw" | `v${number}`;

// Dragging an arrow's mid handle this close (normalized) to the straight from–to line snaps the
// arrow back to straight (clears `via`).
const STRAIGHTEN_DISTANCE = 0.02;

const midpoint = (a: NormalizedPoint, b: NormalizedPoint): NormalizedPoint => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

/** The distance from `p` to the segment `a`–`b` (normalized space). */
function distanceToSegment(p: NormalizedPoint, a: NormalizedPoint, b: NormalizedPoint): number {
  const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2));

  return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
}

/** The four corners of a two-corner shape's bounding box, keyed by compass handle. */
function boxCorners(a: NormalizedPoint, b: NormalizedPoint): Record<"nw" | "ne" | "se" | "sw", NormalizedPoint> {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);

  return {
    nw: { x: minX, y: minY },
    ne: { x: maxX, y: minY },
    se: { x: maxX, y: maxY },
    sw: { x: minX, y: maxY },
  };
}

const OPPOSITE: Partial<Record<AnnotationHandle, "nw" | "ne" | "se" | "sw">> = {
  nw: "se",
  ne: "sw",
  se: "nw",
  sw: "ne",
};

/** The grabbable handles of a shape with their positions, in the order they should render. */
export function annotationHandles(annotation: Annotation): { handle: AnnotationHandle; point: NormalizedPoint }[] {
  switch (annotation.kind) {
    case "line":
      return [
        { handle: "start", point: annotation.a },
        { handle: "end", point: annotation.b },
      ];
    case "arrow":
      return [
        { handle: "start", point: annotation.from },
        { handle: "end", point: annotation.to },
        { handle: "mid", point: annotation.via ?? midpoint(annotation.from, annotation.to) },
      ];
    case "rect":
    case "ellipse": {
      const corners = boxCorners(annotation.a, annotation.b);

      return (["nw", "ne", "se", "sw"] as const).map((handle) => ({ handle, point: corners[handle] }));
    }
    case "polygon":
      return annotation.points.map((point, i) => ({ handle: `v${i}` as const, point }));
    case "free":
    case "text":
      return [];
  }
}

/** Move one handle of a shape to `point` (clamped), anchoring a box's opposite corner. */
export function reshapeAnnotation(
  annotation: Annotation,
  handle: AnnotationHandle,
  point: NormalizedPoint
): Annotation {
  const p = clampToCourt(point);

  switch (annotation.kind) {
    case "line":
      return handle === "start" ? { ...annotation, a: p } : handle === "end" ? { ...annotation, b: p } : annotation;
    // The mid handle bends the arrow through the dragged point, snapping back to straight near the
    // from–to line; moving an endpoint carries `via` along by half the delta, so the midpoint bend
    // keeps its shape relative to the moving chord.
    case "arrow": {
      if (handle === "mid") {
        const { via: _via, ...straight } = annotation;

        return distanceToSegment(p, annotation.from, annotation.to) < STRAIGHTEN_DISTANCE
          ? straight
          : { ...straight, via: p };
      }

      if (handle !== "start" && handle !== "end") return annotation;

      const old = handle === "start" ? annotation.from : annotation.to;
      const moved = handle === "start" ? { ...annotation, from: p } : { ...annotation, to: p };

      return annotation.via
        ? { ...moved, via: shiftPoint(annotation.via, (p.x - old.x) / 2, (p.y - old.y) / 2) }
        : moved;
    }
    case "rect":
    case "ellipse": {
      const anchor = OPPOSITE[handle];

      return anchor ? { ...annotation, a: p, b: boxCorners(annotation.a, annotation.b)[anchor] } : annotation;
    }
    case "polygon": {
      const index = handle.startsWith("v") ? Number(handle.slice(1)) : -1;

      if (index < 0 || index >= annotation.points.length) return annotation;

      return { ...annotation, points: annotation.points.map((point, i) => (i === index ? p : point)) };
    }
    case "free":
    case "text":
      return annotation;
  }
}
