import type { Topic, TopicBlock } from "./types";

const STORAGE_KEY = "volleycoach-topics";

// The first-run starter tree: a few flat top-level topics so the sidebar opens as a small table of
// contents instead of empty. Nesting is a coach's call (the tree supports any depth) — the seed just
// stays flat. Each opens with its explanation as a single markdown block; no seed places a board
// group, so the sample boards (see boards/storage.ts) filed under a topic show in its trailing grid.

export const SAMPLE_TOPICS: Topic[] = [
  {
    id: "topic-rotations",
    title: "Rotations",
    slug: "rotations",
    blocks: [
      {
        id: "topic-rotations-intro",
        kind: "markdown",
        text: "How we line up and rotate — serve-receive and base positions through each rotation.",
      },
    ],
    parentId: null,
    order: 0,
  },
  {
    id: "topic-defense",
    title: "Defense",
    slug: "defense",
    blocks: [
      {
        id: "topic-defense-intro",
        kind: "markdown",
        text: "Our base defence and how we read the attack — who takes the line, who digs cross-court.",
      },
    ],
    parentId: null,
    order: 1,
  },
  {
    id: "topic-drills",
    title: "Drills",
    slug: "drills",
    blocks: [
      {
        id: "topic-drills-intro",
        kind: "markdown",
        text: "Repeatable **drills** for training: serve receive, transition, and out-of-system reps.",
      },
    ],
    parentId: null,
    order: 2,
  },
];

function isTopicBlock(value: unknown): value is TopicBlock {
  if (typeof value !== "object" || value === null) return false;

  const b = value as Record<string, unknown>;

  if (typeof b.id !== "string") return false;
  if (b.kind === "markdown") return typeof b.text === "string";
  if (b.kind === "boards") return Array.isArray(b.boardIds) && b.boardIds.every((id) => typeof id === "string");

  return false;
}

function isTopic(value: unknown): value is Topic {
  if (typeof value !== "object" || value === null) return false;

  const t = value as Record<string, unknown>;

  return (
    typeof t.id === "string" &&
    typeof t.title === "string" &&
    Array.isArray(t.blocks) &&
    t.blocks.every(isTopicBlock) &&
    (t.parentId === null || typeof t.parentId === "string") &&
    typeof t.order === "number"
  );
}

/** Load the saved topics, or `null` when nothing valid has been stored yet (so the caller can seed). */
export function loadTopics(): Topic[] | null {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (raw === null) return null;

  try {
    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed) && parsed.every(isTopic) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveTopics(topics: readonly Topic[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(topics));
}

/** Drop the saved topics so the next load reseeds `SAMPLE_TOPICS`. */
export function clearTopics(): void {
  localStorage.removeItem(STORAGE_KEY);
}
