import type { NormalizedPoint } from "../court/geometry";
import type { CourtMode, MarkerRole } from "../court/roles";
import type { Marker } from "../court/types";
import { makeMarker } from "../tactics/operations";
import type { Drill, DrillMarker, DrillStep } from "./types";

// Pure transforms over a drill, its steps, and its markers. A position edit touches one step; an
// identity edit (role, label, colour, add, remove) spans every step, so a marker stays one identity
// throughout. Nothing here touches storage or the DOM. `makeMarker` is reused from tactics so
// labelling and bench placement are identical across both content types.

function newId(): string {
  return crypto.randomUUID();
}

function makeStep(positions: Record<string, NormalizedPoint> = {}): DrillStep {
  return { id: newId(), instruction: "", positions };
}

export function createDrill(now: number, mode: CourtMode = "positions", title = "Untitled drill"): Drill {
  return {
    id: newId(),
    title,
    description: "",
    mode,
    markers: [],
    steps: [makeStep()],
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Step `index`'s markers as full `Marker`s (identity plus that step's position), ready for the Court. */
export function stepMarkers(drill: Drill, index: number): Marker[] {
  const step = drill.steps[index];

  if (!step) return [];

  return drill.markers.map((m) => ({ ...m, position: step.positions[m.id] }));
}

/** A marker's movement between two steps — the delta arrows are derived from and playback animates. */
export type MarkerMove = { id: string; from: NormalizedPoint; to: NormalizedPoint };

// Below this distance (normalized) a marker counts as stationary, so it draws no arrow.
const MOVE_EPSILON = 0.01;

/** Markers that move from step `index` to the next — derived purely from their position deltas. */
export function stepMoves(drill: Drill, index: number): MarkerMove[] {
  const from = drill.steps[index];
  const to = drill.steps[index + 1];

  if (!from || !to) return [];

  return drill.markers
    .map((m) => ({ id: m.id, from: from.positions[m.id], to: to.positions[m.id] }))
    .filter(({ from: a, to: b }) => Math.hypot(b.x - a.x, b.y - a.y) > MOVE_EPSILON);
}

/** Insert a step after `afterIndex`, cloning that step's positions so only what changes needs dragging. */
export function insertStep(drill: Drill, afterIndex: number): { drill: Drill; stepId: string } {
  const base = drill.steps[afterIndex] ?? drill.steps[drill.steps.length - 1];
  const step = makeStep({ ...base.positions });
  const steps = [...drill.steps];

  steps.splice(afterIndex + 1, 0, step);

  return { drill: { ...drill, steps }, stepId: step.id };
}

/** Reorder the step at `from` to index `to`. */
export function moveStep(drill: Drill, from: number, to: number): Drill {
  if (from === to || to < 0 || to >= drill.steps.length) return drill;

  const steps = [...drill.steps];
  const [moved] = steps.splice(from, 1);

  if (!moved) return drill;

  steps.splice(to, 0, moved);

  return { ...drill, steps };
}

/** Remove a step, always keeping at least one. */
export function removeStep(drill: Drill, stepId: string): Drill {
  if (drill.steps.length <= 1) return drill;

  return { ...drill, steps: drill.steps.filter((s) => s.id !== stepId) };
}

export function setStepInstruction(drill: Drill, stepId: string, instruction: string): Drill {
  return { ...drill, steps: drill.steps.map((s) => (s.id === stepId ? { ...s, instruction } : s)) };
}

/** Move one marker on one step, leaving every other step's positions untouched. */
export function setStepPosition(drill: Drill, stepId: string, markerId: string, position: NormalizedPoint): Drill {
  return {
    ...drill,
    steps: drill.steps.map((s) =>
      s.id === stepId ? { ...s, positions: { ...s.positions, [markerId]: position } } : s
    ),
  };
}

/** Add a marker to the drill, benched on step `index` across every step, ready to be dragged on. */
export function addMarker(drill: Drill, role: MarkerRole, index: number): { drill: Drill; markerId: string } {
  const { position, ...identity } = makeMarker(role, stepMarkers(drill, index));

  return {
    markerId: identity.id,
    drill: {
      ...drill,
      markers: [...drill.markers, identity],
      steps: drill.steps.map((s) => ({ ...s, positions: { ...s.positions, [identity.id]: position } })),
    },
  };
}

/** Patch a marker's shared identity (role, label, colour) across the whole drill. */
export function setMarker(drill: Drill, markerId: string, patch: Partial<DrillMarker>): Drill {
  return { ...drill, markers: drill.markers.map((m) => (m.id === markerId ? { ...m, ...patch } : m)) };
}

/** Remove a marker from the drill entirely — its identity and its position on every step. */
export function removeMarker(drill: Drill, markerId: string): Drill {
  return {
    ...drill,
    markers: drill.markers.filter((m) => m.id !== markerId),
    steps: drill.steps.map(({ positions, ...s }) => {
      const { [markerId]: _removed, ...rest } = positions;

      return { ...s, positions: rest };
    }),
  };
}
