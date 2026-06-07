import type { Board } from "./types";

const STORAGE_KEY = "volleycoach-boards";

// The first-run seeds, one of each kind, so the library opens with something to explore rather than
// empty. "Sample Position (Base Defence)" is a Position (one step) — a perimeter defence against an
// outside attack. "Sample Drill (Serve Receive & Sideout)" is a Sequence (four steps): serve,
// receive, set, hit, finishing to OH1 at the antenna; marker ids stay stable across the steps so
// playback glides each one by identity and the movement arrows derive from the deltas.

const SAMPLE_POSITION: Board = {
  id: "sample-perimeter-defence",
  title: "Sample Position (Base Defence)",
  description:
    "**Perimeter defence** against an outside attack.\n\n" +
    "- Cross Block\n" +
    "- **Setter:** Foot on side-line. Main target is hard line hit. Ready for tips.\n" +
    "- **OH2:** Deep inside the block. Main target: Everything high off the block and long line shots\n" +
    "- **Lib:** Just outside the block shadow. Main target is the cross power hit.\n" +
    "- **OH1:** Defending sharp hits and/or tips to middle of court",
  mode: "positions",
  tags: ["sample", "defense"],
  topicId: "topic-defense",
  owner: "",
  authorLocked: false,
  shared: false,
  teamId: null,
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
        opp: { x: 0.89, y: 0.05 },
        mb1: { x: 0.82, y: 0.05 },
        oh1: { x: 0.14, y: 0.31 },
        s: { x: 0.95, y: 0.6 },
        l: { x: 0.18, y: 0.72 },
        oh2: { x: 0.72, y: 0.92 },
        ball: { x: 0.95, y: -0.09 },
      },
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

const SAMPLE_SEQUENCE: Board = {
  id: "sample-outside-attack",
  title: "Sample Drill (Serve Receive & Sideout)",
  description: "### Serve Reception & Sideout",
  mode: "positions",
  tags: ["sample", "reception"],
  topicId: "topic-drills",
  owner: "",
  authorLocked: false,
  shared: false,
  teamId: null,
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
      instruction: "- Serve receive\n- L and OH2 each cover 40% of the court\n- OH1 covers the remaining 20%",
      positions: {
        s: { x: 0.72, y: 0.18 },
        mb1: { x: 0.4, y: 0.15 },
        oh1: { x: 0.1, y: 0.66 },
        oh2: { x: 0.8, y: 0.72 },
        l: { x: 0.4, y: 0.72 },
        ball: { x: 0.6, y: -0.09 },
      },
    },
    {
      id: "step-2",
      instruction: "- Pass to the middle, close to the net\n- OH1 kicks out wide for the approach",
      positions: {
        s: { x: 0.52, y: 0.13 },
        mb1: { x: 0.42, y: 0.15 },
        oh1: { x: 0.0, y: 0.48 },
        oh2: { x: 0.78, y: 0.62 },
        l: { x: 0.58, y: 0.72 },
        ball: { x: 0.6, y: 0.72 },
      },
    },
    {
      id: "step-3",
      instruction: "- Set to the antenna\n- MB1 jumps with the set",
      positions: {
        s: { x: 0.5, y: 0.11 },
        mb1: { x: 0.38, y: 0.06 },
        oh1: { x: -0.1, y: 0.3 },
        oh2: { x: 0.5, y: 0.6 },
        l: { x: 0.35, y: 0.52 },
        ball: { x: 0.5, y: 0.13 },
      },
    },
    {
      id: "step-4",
      instruction: "- OH1 attacks\n- Everyone covers: libero, MB1 and setter tight, OH2 deep in the middle",
      positions: {
        s: { x: 0.45, y: 0.15 },
        mb1: { x: 0.25, y: 0.12 },
        oh1: { x: 0.06, y: 0.13 },
        oh2: { x: 0.45, y: 0.55 },
        l: { x: 0.1, y: 0.3 },
        ball: { x: 0.06, y: 0.05 },
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

    if (!Array.isArray(parsed) || !parsed.every(isBoard)) return null;

    // Boards saved before Topics carry no home topic; default them to Unfiled so the field is honest.
    return parsed.map((b) => ({ ...b, topicId: b.topicId ?? null }));
  } catch {
    return null;
  }
}

export function saveBoards(boards: readonly Board[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
}

/** Drop the saved boards so the next load reseeds `SAMPLE_BOARDS`. */
export function clearBoards(): void {
  localStorage.removeItem(STORAGE_KEY);
}
