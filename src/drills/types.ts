import type { NormalizedPoint } from "../court/geometry";
import type { CourtMode } from "../court/roles";
import type { Marker } from "../court/types";

// A drill is the animated counterpart of a tactic: an ordered list of steps the viewer glides
// through. Marker identity (role, label, colour) is shared across every step — the spine decision
// that lets playback interpolate by identity and movement arrows fall out of step-to-step deltas.
// Only a marker's position changes from step to step, so positions live on the step, not the identity.

/** A marker's stable identity, shared across all of a drill's steps (everything but its position). */
export type DrillMarker = Omit<Marker, "position">;

/** One step: an instruction shown during playback, and where each marker sits for this step. */
export type DrillStep = {
  id: string;
  instruction: string;
  /** Position of each marker on this step, keyed by marker id. */
  positions: Record<string, NormalizedPoint>;
};

export type Drill = {
  id: string;
  title: string;
  /** Markdown. */
  description: string;
  mode: CourtMode;
  /** Shared marker identities; their positions live per-step. */
  markers: DrillMarker[];
  steps: DrillStep[];
  /** Free-form organising tags the library filters by. */
  tags: string[];
  createdAt: number;
  updatedAt: number;
};
