import type { Board } from "./types";

const STORAGE_KEY = "volleycoach-boards";

// The first-run seeds, one of each kind, so the library opens with something to explore rather than
// empty. "Base defence" is a Position (one step) — a perimeter defence against an outside attack, the
// block formed beneath the high ball. "Serve receive to outside" is a Sequence (three steps): the
// pass travels to the setter, the left side opens, and OH1 finishes; marker ids stay stable across
// the steps so playback glides each one by identity and the movement arrows derive from the deltas.

const SAMPLE_POSITION: Board = {
  id: "sample-perimeter-defence",
  title: "Base defence",
  description:
    "**Perimeter defence** against an outside attack.\n\n" +
    "- The block takes the line; the **libero** digs cross-court.\n" +
    "- The **setter** releases off the net to chase the second ball.\n" +
    "- Back-row players hold the deep corners.",
  mode: "positions",
  tags: ["Defence", "Outside attack"],
  markers: [
    { id: "opp", role: "opposite", label: "OPP" },
    { id: "mb1", role: "middle", label: "MB1" },
    { id: "oh1", role: "outside", label: "OH1" },
    { id: "s", role: "setter", label: "S" },
    { id: "l", role: "libero", label: "L" },
    { id: "oh2", role: "outside", label: "OH2" },
    { id: "ball", role: "ball" },
  ],
  steps: [
    {
      id: "step-1",
      instruction: "",
      positions: {
        opp: { x: 0.82, y: 0.08 },
        mb1: { x: 0.64, y: 0.08 },
        oh1: { x: 0.22, y: 0.27 },
        s: { x: 0.84, y: 0.55 },
        l: { x: 0.2, y: 0.7 },
        oh2: { x: 0.5, y: 0.85 },
        ball: { x: 0.8, y: -0.085 },
      },
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

const SAMPLE_SEQUENCE: Board = {
  id: "sample-outside-attack",
  title: "Serve receive to outside",
  description:
    "A first-ball **side-out** off serve receive.\n\n" +
    "- The libero and outsides pass; the **setter** releases to the net.\n" +
    "- The pass travels to target as the left side opens for the approach.\n" +
    "- The setter delivers, and **OH1** attacks down the line.",
  mode: "positions",
  tags: ["Serve receive", "Outside attack"],
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

export const SAMPLE_BOARDS: Board[] = [SAMPLE_POSITION, SAMPLE_SEQUENCE];

function isBoard(value: unknown): value is Board {
  if (typeof value !== "object" || value === null) return false;

  const b = value as Record<string, unknown>;

  return typeof b.id === "string" && typeof b.title === "string" && Array.isArray(b.markers) && Array.isArray(b.steps);
}

/** Load the saved boards, or `null` when nothing valid has been stored yet (so the caller can seed). */
export function loadBoards(): Board[] | null {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (raw === null) return null;

  try {
    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed) && parsed.every(isBoard) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveBoards(boards: readonly Board[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
}
