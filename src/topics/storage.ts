import type { Topic } from "./types";

const STORAGE_KEY = "volleycoach-topics";

// The first-run starter tree: a few flat top-level topics so the sidebar opens as a small table of
// contents instead of empty. Nesting is a coach's call (the tree supports any depth) — the seed just
// stays flat. The sample boards (see boards/storage.ts) are filed under these by their stable ids.

export const SAMPLE_TOPICS: Topic[] = [
  {
    id: "topic-rotations",
    title: "Rotations",
    body: "How we line up and rotate — serve-receive and base positions through each rotation.",
    parentId: null,
    order: 0,
  },
  {
    id: "topic-defense",
    title: "Defense",
    body: "Our base defence and how we read the attack — who takes the line, who digs cross-court.",
    parentId: null,
    order: 1,
  },
  {
    id: "topic-drills",
    title: "Drills",
    body: "Repeatable **drills** for training: serve receive, transition, and out-of-system reps.",
    parentId: null,
    order: 2,
  },
];

function isTopic(value: unknown): value is Topic {
  if (typeof value !== "object" || value === null) return false;

  const t = value as Record<string, unknown>;

  return (
    typeof t.id === "string" &&
    typeof t.title === "string" &&
    typeof t.body === "string" &&
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
