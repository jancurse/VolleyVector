import type { NormalizedPoint } from "../court/geometry";
import type { CourtMode, MarkerRole } from "../court/roles";
import { ROLES } from "../court/roles";
import type { Marker } from "../court/types";
import type { Board, BoardMarker, BoardStep } from "./types";

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

function benchPosition(markers: readonly Marker[]): NormalizedPoint {
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
    topicId: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Boards filed directly under `topicId`, newest-edited first (matching the library order). */
export function boardsInTopic(boards: readonly Board[], topicId: string): Board[] {
  return boards.filter((b) => b.topicId === topicId).sort((a, b) => b.updatedAt - a.updatedAt);
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

/** Insert a step after `afterIndex`, cloning that step's positions so only what changes needs dragging. */
export function insertStep(board: Board, afterIndex: number): { board: Board; stepId: string } {
  const base = board.steps[afterIndex] ?? board.steps[board.steps.length - 1];
  const step = makeStep({ ...base.positions });
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
