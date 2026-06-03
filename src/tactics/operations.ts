import type { NormalizedPoint } from "../court/geometry";
import type { CourtMode, MarkerRole } from "../court/roles";
import { ROLES } from "../court/roles";
import type { Marker } from "../court/types";
import type { Tactic } from "./types";

// Pure transforms over a tactic and its markers. Nothing here touches storage or the DOM, so the
// authoring rules (labelling, placement, immutable updates) stay easy to reason about and test.

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

/** Merge a patch into the marker with `id`, leaving the rest untouched. */
export function setMarker(markers: readonly Marker[], id: string, patch: Partial<Marker>): Marker[] {
  return markers.map((m) => (m.id === id ? { ...m, ...patch } : m));
}

export function removeMarker(markers: readonly Marker[], id: string): Marker[] {
  return markers.filter((m) => m.id !== id);
}

export function createTactic(now: number, mode: CourtMode = "positions", title = "Untitled tactic"): Tactic {
  return { id: newId(), title, description: "", mode, markers: [], tags: [], createdAt: now, updatedAt: now };
}
