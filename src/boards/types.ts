import type { NormalizedPoint } from "../court/geometry";
import type { CourtMode } from "../court/roles";
import type { Marker } from "../court/types";

// A board is one diagram on the court: an ordered, non-empty list of steps over a shared set of
// marker identities. A board with one step is a Position (static, like a tactic); a board with two or
// more steps is a Sequence (animated, like a drill). Marker identity (role, label, colour) is shared
// across every step — the spine decision that lets playback interpolate by identity and movement
// arrows fall out of step-to-step deltas — so only a marker's position changes from step to step.

/** A marker's stable identity, shared across all of a board's steps (everything but its position). */
export type BoardMarker = Omit<Marker, "position">;

/** One step: an instruction shown during playback, and where each marker sits for this step. */
export type BoardStep = {
  id: string;
  instruction: string;
  /** Position of each marker on this step, keyed by marker id. */
  positions: Record<string, NormalizedPoint>;
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
  /** The board's home topic, or `null` when Unfiled. The one source of truth for topic membership. */
  topicId: string | null;
  /** Manual order among the boards sharing this home topic; ignored while Unfiled. */
  topicOrder: number;
  createdAt: number;
  updatedAt: number;
};

/** A Sequence has two or more steps; a one-step board is a Position. */
export function isSequence(board: Board): boolean {
  return board.steps.length > 1;
}
