import type { Tactic } from "./types";

const STORAGE_KEY = "volleycoach-tactics";

// The first-run sample, so the editor opens with something to play with rather than an empty court.
// A perimeter defence against an outside attack: the opposing outside hitter attacks from their
// position 4, mirrored to our right, so the ball sits high-x with the block formed beneath it.
export const SAMPLE_TACTIC: Tactic = {
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
    { id: "opp", role: "opposite", label: "OPP", position: { x: 0.82, y: 0.08 } },
    { id: "mb1", role: "middle", label: "MB1", position: { x: 0.64, y: 0.08 } },
    { id: "oh1", role: "outside", label: "OH1", position: { x: 0.22, y: 0.27 } },
    { id: "s", role: "setter", label: "S", position: { x: 0.84, y: 0.55 } },
    { id: "l", role: "libero", label: "L", position: { x: 0.2, y: 0.7 } },
    { id: "oh2", role: "outside", label: "OH2", position: { x: 0.5, y: 0.85 } },
    { id: "ball", role: "ball", position: { x: 0.8, y: -0.085 } },
  ],
  createdAt: 0,
  updatedAt: 0,
};

function isTactic(value: unknown): value is Tactic {
  if (typeof value !== "object" || value === null) return false;

  const t = value as Record<string, unknown>;

  return typeof t.id === "string" && typeof t.title === "string" && Array.isArray(t.markers);
}

/** Load the saved tactics, or `null` when nothing valid has been stored yet (so the caller can seed). */
export function loadTactics(): Tactic[] | null {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (raw === null) return null;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed) || !parsed.every(isTactic)) return null;

    // Default the mode and tags so tactics stored before they existed still load.
    return parsed.map((tactic) => ({ ...tactic, mode: tactic.mode ?? "positions", tags: tactic.tags ?? [] }));
  } catch {
    return null;
  }
}

export function saveTactics(tactics: readonly Tactic[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tactics));
}
