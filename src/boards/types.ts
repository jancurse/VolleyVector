import type { NormalizedPoint } from "../court/geometry";
import type { CourtMode } from "../court/roles";
import type { Annotation, Marker } from "../court/types";
import type { Capability } from "../supabase/rows";

export type { Capability } from "../supabase/rows";

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
  /** The account that created the board (attribution only), or null once their account is deleted. */
  createdBy: string | null;
  /** The viewer's own access, derived from the access list and never stored: gates the UI. */
  capability: Capability;
  /** The revision this board's content matches; the base for the next commit's conflict check. */
  currentRevisionId: string | null;
  /** Whether the derived movement arrows are shown. Off hides them entirely; manual arrows are unaffected. */
  autoArrows: boolean;
  /** Rotation enforcement: strict clamps dragging at the legal boundary; loose (the default) only flags. */
  rotationStrict: boolean;
  /** Whether the opponent half is shown. Off (the default) is a half-court board holding our side only. */
  opponentSide: boolean;
  createdAt: number;
  updatedAt: number;
};

/** A Sequence has two or more steps; a one-step board is a Position. */
export function isSequence(board: Board): boolean {
  return board.steps.length > 1;
}
