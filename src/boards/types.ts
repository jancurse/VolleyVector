import type { NormalizedPoint } from "../court/geometry";
import type { CourtMode } from "../court/roles";
import type { Annotation, Marker } from "../court/types";

export type { Annotation, AnnotationKind, AnnotationStyle } from "../court/types";

// A board is one diagram on the court: an ordered, non-empty list of steps over a shared set of
// marker identities. A board with one step is a Position (static, like a tactic); a board with two or
// more steps is a Sequence (animated, like a drill). Marker identity (role, label, colour) is shared
// across every step — the spine decision that lets playback interpolate by identity and movement
// arrows fall out of step-to-step deltas — so only a marker's position changes from step to step.

/** A marker's stable identity, shared across all of a board's steps (everything but its position). */
export type BoardMarker = Omit<Marker, "position">;

/** One of the six official positions of the rotational order (FIVB Rule 7.4.1):
 *  front row 4-3-2 (left to right, viewed from behind the team), back row 5-6-1. */
export type RotationSlot = 1 | 2 | 3 | 4 | 5 | 6;

/** A step's rotation: a 5-1 preset numbered by the setter's official position, or a custom
 *  assignment of markers to official positions (complete once all six slots are filled). */
export type StepRotation =
  | { kind: "preset"; rotation: RotationSlot }
  | { kind: "custom"; assignment: Partial<Record<RotationSlot, string>> };

/** One step: an instruction shown during playback, where each marker sits, and any drawn annotations. */
export type BoardStep = {
  id: string;
  instruction: string;
  /** Position of each marker on this step, keyed by marker id. */
  positions: Record<string, NormalizedPoint>;
  /** Drawings on this step (lines, arrows, shapes, freehand). Optional: a step without any has none. */
  annotations?: Annotation[];
  /** The step's rotation, when set. Optional: a step without one behaves exactly as before. */
  rotation?: StepRotation;
};

export type Board = {
  id: string;
  title: string;
  /** Markdown. */
  description: string;
  mode: CourtMode;
  /** Shared marker identities; their positions live per-step. */
  markers: BoardMarker[];
  /** Ordered and non-empty: one step is a Position, two or more is a Sequence. */
  steps: BoardStep[];
  /** Free-form organising tags the library filters by. */
  tags: string[];
  /** The account that created the board (its author), or null when authored by the team after the author's
   *  account was deleted. Set server-side; the source of truth for the lock. */
  owner: string | null;
  /** When set on a team board, only the author and admins may edit, delete, or clear the lock. */
  authorLocked: boolean;
  /** A personal board the owner has shared: visible to its target team and link-resolvable. */
  shared: boolean;
  /** For a team board, its owning team; for a shared personal board, the team it is shared into. */
  teamId: string | null;
  /** Whether the derived movement arrows are shown. Off hides them entirely; manual arrows are unaffected. */
  autoArrows: boolean;
  /** Rotation enforcement: strict clamps dragging at the legal boundary; loose (the default) only flags. */
  rotationStrict: boolean;
  createdAt: number;
  updatedAt: number;
};

/** A Sequence has two or more steps; a one-step board is a Position. */
export function isSequence(board: Board): boolean {
  return board.steps.length > 1;
}
