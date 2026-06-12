import type { NormalizedPoint } from "../court/geometry";
import type { MarkerRole } from "../court/roles";
import type { Board, BoardMarker, RotationSlot, StepRotation } from "./types";

// Rotation legality, pure over the board model: which markers may take the six official positions,
// how the 5-1 presets assign them, which arrangements break the overlap rules (FIVB Rule 7.4), and
// where strict mode clamps a drag. Nothing here renders or touches the DOM.

export const ROTATION_SLOTS: readonly RotationSlot[] = [1, 2, 3, 4, 5, 6];

/** The six official positions as canonical court points: front row 4-3-2, back row 5-6-1. */
export const OFFICIAL_SPOTS: Record<RotationSlot, NormalizedPoint> = {
  4: { x: 0.2, y: 0.22 },
  3: { x: 0.5, y: 0.22 },
  2: { x: 0.8, y: 0.22 },
  5: { x: 0.2, y: 0.72 },
  6: { x: 0.5, y: 0.72 },
  1: { x: 0.8, y: 0.72 },
};

const FRONT_ROW: ReadonlySet<RotationSlot> = new Set([2, 3, 4]);

export function isFrontRow(slot: RotationSlot): boolean {
  return FRONT_ROW.has(slot);
}

// Roles that may take an official position; the ball and coach never do.
const PLAYER_ROLES: ReadonlySet<MarkerRole> = new Set(["setter", "outside", "middle", "opposite", "libero", "player"]);

/** The markers eligible for an official position. Six are needed before rotation can turn on. */
export function rotationPlayers(markers: readonly BoardMarker[]): BoardMarker[] {
  return markers.filter((m) => PLAYER_ROLES.has(m.role));
}

const byLabel = (a: BoardMarker, b: BoardMarker) => (a.label ?? "").localeCompare(b.label ?? "");

/** The 5-1 service order S → OH1 → MB1 → OPP → OH2 → MB2 (with a libero standing in for MB2), or
 *  null when the roster is not a 5-1: exactly one setter, two outsides, one opposite, and either two
 *  middles or one middle plus one libero. Which outside/middle is first is label order only. */
export function presetOrder(markers: readonly BoardMarker[]): BoardMarker[] | null {
  const players = rotationPlayers(markers);

  if (players.length !== 6) return null;

  const of = (role: MarkerRole) => players.filter((p) => p.role === role).sort(byLabel);
  const [setters, outsides, middles, opposites, liberos] = (
    ["setter", "outside", "middle", "opposite", "libero"] as const
  ).map(of);

  if (setters.length !== 1 || outsides.length !== 2 || opposites.length !== 1) return null;
  if (middles.length + liberos.length !== 2 || middles.length === 0) return null;

  return [setters[0], outsides[0], middles[0], opposites[0], outsides[1], middles[1] ?? liberos[0]];
}

/** The slot of service-order index `i` (0 = the setter) when the setter stands at `setterSlot`. */
function slotAt(setterSlot: RotationSlot, i: number): RotationSlot {
  return (((setterSlot - 1 + i) % 6) + 1) as RotationSlot;
}

/** The assignment Rotation `rotation` (a 5-1 preset) gives the roster, or null when the roster does
 *  not match a 5-1. With a libero, it takes the back-row middle slot and the middle the front-row
 *  one, re-derived per rotation (the two middle slots are always one front-row, one back-row). */
export function presetAssignment(
  markers: readonly BoardMarker[],
  rotation: RotationSlot
): Record<RotationSlot, string> | null {
  const order = presetOrder(markers);

  if (!order) return null;

  const assignment = {} as Record<RotationSlot, string>;

  order.forEach((p, i) => (assignment[slotAt(rotation, i)] = p.id));

  const libero = order.find((p) => p.role === "libero");

  if (libero) {
    const middleSlot = slotAt(rotation, 2);
    const otherSlot = slotAt(rotation, 5);
    const frontSlot = isFrontRow(middleSlot) ? middleSlot : otherSlot;
    const backSlot = frontSlot === middleSlot ? otherSlot : middleSlot;

    assignment[frontSlot] = order[2].id;
    assignment[backSlot] = libero.id;
  }

  return assignment;
}

/** The complete slot→marker assignment a step's rotation resolves to, or null while rotation is
 *  inactive: off, an unfinished custom assignment, or a preset whose roster no longer matches. */
export function rotationAssignment(
  markers: readonly BoardMarker[],
  rotation: StepRotation | undefined
): Record<RotationSlot, string> | null {
  if (!rotation) return null;
  if (rotation.kind === "preset") return presetAssignment(markers, rotation.rotation);

  const ids = new Set(markers.map((m) => m.id));
  const assigned = ROTATION_SLOTS.map((slot) => rotation.assignment[slot]).filter(
    (id): id is string => id !== undefined && ids.has(id)
  );

  if (new Set(assigned).size !== 6) return null;

  return { ...rotation.assignment } as Record<RotationSlot, string>;
}

/** The label shown while rotation is on. */
export function rotationLabel(rotation: StepRotation): string {
  return rotation.kind === "preset" ? `Rotation ${rotation.rotation}` : "Custom rotation";
}

// The seven pairwise overlap checks of FIVB Rule 7.4: each back-row player not nearer the net than
// their front-row counterpart, and within each row each pair of adjacent players in side order. The
// outer pairs ({4,2}, {5,1}) follow by transitivity and are not checked separately.
const Y_PAIRS: readonly [back: RotationSlot, front: RotationSlot][] = [
  [1, 2],
  [6, 3],
  [5, 4],
];
const X_PAIRS: readonly [left: RotationSlot, right: RotationSlot][] = [
  [4, 3],
  [3, 2],
  [5, 6],
  [6, 1],
];

export type RotationViolation =
  /** A broken pairwise overlap relation between two official positions. */
  | { kind: "pair"; a: RotationSlot; b: RotationSlot }
  /** An assigned player outside the playing area. */
  | { kind: "outside"; slot: RotationSlot }
  /** A libero assigned to a front-row official position (possible only in a custom assignment). */
  | { kind: "libero"; slot: RotationSlot };

const inPlayingArea = (p: NormalizedPoint) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;

/** Every overlap violation of `assignment` over the given marker positions. Comparisons are between
 *  marker centres and ties are legal (the rulebook's "level with or"), so strict-mode clamping may
 *  park a marker exactly on the boundary. */
export function rotationViolations(
  assignment: Record<RotationSlot, string>,
  positions: Record<string, NormalizedPoint>,
  markers: readonly BoardMarker[]
): RotationViolation[] {
  const at = (slot: RotationSlot) => positions[assignment[slot]];
  const violations: RotationViolation[] = [];

  for (const [back, front] of Y_PAIRS)
    if (at(back).y < at(front).y) violations.push({ kind: "pair", a: back, b: front });
  for (const [left, right] of X_PAIRS)
    if (at(left).x > at(right).x) violations.push({ kind: "pair", a: left, b: right });
  for (const slot of ROTATION_SLOTS) if (!inPlayingArea(at(slot))) violations.push({ kind: "outside", slot });

  for (const slot of ROTATION_SLOTS) {
    if (isFrontRow(slot) && markers.find((m) => m.id === assignment[slot])?.role === "libero")
      violations.push({ kind: "libero", slot });
  }

  return violations;
}

/** The court's render data for a set of violations: every flagged marker (both ends of each broken
 *  pair, plus solo flags) and the tie to draw per broken pair. */
export function violationFlags(
  assignment: Record<RotationSlot, string>,
  violations: readonly RotationViolation[]
): { markerIds: string[]; ties: { a: string; b: string }[] } {
  const markerIds = new Set<string>();
  const ties: { a: string; b: string }[] = [];

  for (const v of violations) {
    if (v.kind === "pair") {
      markerIds.add(assignment[v.a]);
      markerIds.add(assignment[v.b]);
      ties.push({ a: assignment[v.a], b: assignment[v.b] });
    } else {
      markerIds.add(assignment[v.slot]);
    }
  }

  return { markerIds: [...markerIds], ties };
}

/** The bounds an assigned player may legally occupy, in normalized coordinates. */
export type LegalRegion = { loX: number; hiX: number; loY: number; hiY: number };

/** The markers whose overlap relations constrain `markerId`: its front/back counterpart and the
 *  adjacent players in its row. Empty for an unassigned marker. */
export function constrainingNeighbours(assignment: Record<RotationSlot, string>, markerId: string): string[] {
  const slot = ROTATION_SLOTS.find((s) => assignment[s] === markerId);

  if (!slot) return [];

  return [...Y_PAIRS, ...X_PAIRS]
    .filter(([a, b]) => a === slot || b === slot)
    .map(([a, b]) => assignment[a === slot ? b : a]);
}

/** The region the overlap rules leave `markerId`, relative to the other assigned players' current
 *  positions: inside the playing area and level with or behind/beside each constraining neighbour.
 *  Null for an unassigned marker (ball, coach, extras). */
export function legalRegion(
  assignment: Record<RotationSlot, string>,
  positions: Record<string, NormalizedPoint>,
  markerId: string
): LegalRegion | null {
  const slot = ROTATION_SLOTS.find((s) => assignment[s] === markerId);

  if (!slot) return null;

  const at = (s: RotationSlot) => positions[assignment[s]];
  let [loX, hiX, loY, hiY] = [0, 1, 0, 1];

  for (const [back, front] of Y_PAIRS) {
    if (slot === back) loY = Math.max(loY, at(front).y);
    if (slot === front) hiY = Math.min(hiY, at(back).y);
  }

  for (const [left, right] of X_PAIRS) {
    if (slot === left) hiX = Math.min(hiX, at(right).x);
    if (slot === right) loX = Math.max(loX, at(left).x);
  }

  return { loX, hiX, loY, hiY };
}

/** Clamp a dragged marker to the region strict mode allows ({@link legalRegion}). An unassigned
 *  marker passes through untouched. */
export function clampToLegal(
  assignment: Record<RotationSlot, string>,
  positions: Record<string, NormalizedPoint>,
  markerId: string,
  desired: NormalizedPoint
): NormalizedPoint {
  const region = legalRegion(assignment, positions, markerId);

  if (!region) return desired;

  const { loX, hiX, loY, hiY } = region;

  return { x: Math.min(hiX, Math.max(loX, desired.x)), y: Math.min(hiY, Math.max(loY, desired.y)) };
}

// Board transforms for rotation, mirroring the step edits in operations.ts: each targets one step.

/** Set or clear one step's rotation. */
export function setStepRotation(board: Board, stepId: string, rotation: StepRotation | undefined): Board {
  return {
    ...board,
    steps: board.steps.map((s) => {
      if (s.id !== stepId) return s;

      const { rotation: _cleared, ...rest } = s;

      return rotation ? { ...rest, rotation } : rest;
    }),
  };
}

/** Place a marker on one official position in a step's custom rotation, or back on the bench with
 *  `slot: null`. An occupied position swaps: its occupant takes the position the marker came from,
 *  or the bench when the marker came from the bench. */
export function placeRotationMarker(board: Board, stepId: string, markerId: string, slot: RotationSlot | null): Board {
  return {
    ...board,
    steps: board.steps.map((s) => {
      if (s.id !== stepId || s.rotation?.kind !== "custom") return s;

      const assignment = { ...s.rotation.assignment };
      const from = ROTATION_SLOTS.find((sl) => assignment[sl] === markerId);

      if (from) delete assignment[from];

      if (slot) {
        const occupant = assignment[slot];

        assignment[slot] = markerId;
        if (occupant && from) assignment[from] = occupant;
      }

      return { ...s, rotation: { kind: "custom", assignment } };
    }),
  };
}
