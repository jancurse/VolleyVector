import type { Drill } from "./types";

const STORAGE_KEY = "volleycoach-drills";

// The first-run sample, so the drills view opens with something to play rather than an empty court.
// A serve-receive into an outside attack: the pass travels to the setter, the left side opens up,
// and OH1 finishes the approach. Marker ids stay stable across the three steps so playback glides
// each one by identity and the movement arrows derive from the deltas.
export const SAMPLE_DRILL: Drill = {
  id: "sample-outside-attack",
  title: "Serve receive to outside",
  description:
    "A first-ball **side-out** off serve receive.\n\n" +
    "- The libero and outsides pass; the **setter** releases to the net.\n" +
    "- The pass travels to target as the left side opens for the approach.\n" +
    "- The setter delivers, and **OH1** attacks down the line.",
  mode: "positions",
  markers: [
    { id: "s", role: "setter", label: "S" },
    { id: "mb1", role: "middle", label: "MB1" },
    { id: "oh1", role: "outside", label: "OH1" },
    { id: "oh2", role: "outside", label: "OH2" },
    { id: "l", role: "libero", label: "L" },
    { id: "ball", role: "ball" },
  ],
  steps: [
    {
      id: "step-1",
      instruction: "Serve receive — the libero and outsides pass; the setter releases to the net.",
      positions: {
        s: { x: 0.7, y: 0.2 },
        mb1: { x: 0.45, y: 0.12 },
        oh1: { x: 0.18, y: 0.62 },
        oh2: { x: 0.8, y: 0.6 },
        l: { x: 0.5, y: 0.7 },
        ball: { x: 0.42, y: -0.06 },
      },
    },
    {
      id: "step-2",
      instruction: "The pass travels to the setter as the left side opens up for the approach.",
      positions: {
        s: { x: 0.66, y: 0.16 },
        mb1: { x: 0.45, y: 0.12 },
        oh1: { x: 0.14, y: 0.42 },
        oh2: { x: 0.8, y: 0.58 },
        l: { x: 0.5, y: 0.66 },
        ball: { x: 0.62, y: 0.18 },
      },
    },
    {
      id: "step-3",
      instruction: "Set to the outside — OH1 finishes the approach and attacks down the line.",
      positions: {
        s: { x: 0.64, y: 0.15 },
        mb1: { x: 0.4, y: 0.12 },
        oh1: { x: 0.17, y: 0.16 },
        oh2: { x: 0.72, y: 0.5 },
        l: { x: 0.46, y: 0.6 },
        ball: { x: 0.17, y: 0.06 },
      },
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

function isDrill(value: unknown): value is Drill {
  if (typeof value !== "object" || value === null) return false;

  const d = value as Record<string, unknown>;

  return typeof d.id === "string" && typeof d.title === "string" && Array.isArray(d.markers) && Array.isArray(d.steps);
}

/** Load the saved drills, or `null` when nothing valid has been stored yet (so the caller can seed). */
export function loadDrills(): Drill[] | null {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (raw === null) return null;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed) || !parsed.every(isDrill)) return null;

    return parsed.map((drill) => ({ ...drill, mode: drill.mode ?? "positions" }));
  } catch {
    return null;
  }
}

export function saveDrills(drills: readonly Drill[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drills));
}
