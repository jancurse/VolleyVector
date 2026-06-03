import type { Topic } from "./types";

// Pure transforms over the topic tree. Nesting lives in `parentId` and order in `order` among
// siblings, so every operation works on those two fields. Nothing here touches storage, the DOM, or
// a board — a topic deletion's effect on the boards filed under it is the caller's job.

function newId(): string {
  return crypto.randomUUID();
}

/** A parent's direct children in their manual order. Pass `null` for the top-level (root) topics. */
export function childrenOf(topics: readonly Topic[], parentId: string | null): Topic[] {
  return topics.filter((t) => t.parentId === parentId).sort((a, b) => a.order - b.order);
}

/** A topic's id plus every descendant id — for cascade deletes and cycle guards. */
export function subtreeIds(topics: readonly Topic[], id: string): string[] {
  return [id, ...topics.filter((t) => t.parentId === id).flatMap((child) => subtreeIds(topics, child.id))];
}

/** A topic paired with its depth in the tree, in depth-first sibling order. */
export type FlatTopic = { topic: Topic; depth: number };

/** Flatten the tree depth-first, tagging each topic with its depth — for the picker and the sidebar. */
export function flattenTopics(topics: readonly Topic[], parentId: string | null = null, depth = 0): FlatTopic[] {
  return childrenOf(topics, parentId).flatMap((topic) => [
    { topic, depth },
    ...flattenTopics(topics, topic.id, depth + 1),
  ]);
}

function nextOrder(topics: readonly Topic[], parentId: string | null): number {
  return topics.filter((t) => t.parentId === parentId).reduce((max, t) => Math.max(max, t.order), -1) + 1;
}

/** Add a topic under `parentId` (`null` for a root), appended after its siblings. */
export function createTopic(
  topics: readonly Topic[],
  parentId: string | null,
  title = "New topic"
): { topics: Topic[]; id: string } {
  const topic: Topic = { id: newId(), title, body: "", parentId, order: nextOrder(topics, parentId) };

  return { topics: [...topics, topic], id: topic.id };
}

/** Patch a topic's editable fields (title, body). */
export function setTopic(topics: readonly Topic[], id: string, patch: Partial<Pick<Topic, "title" | "body">>): Topic[] {
  return topics.map((t) => (t.id === id ? { ...t, ...patch } : t));
}

/** Remove a topic and its whole subtree. Boards filed under any of them are unfiled by the caller. */
export function deleteTopic(topics: readonly Topic[], id: string): Topic[] {
  const removed = new Set(subtreeIds(topics, id));

  return topics.filter((t) => !removed.has(t.id));
}

/** Re-parent a topic under `parentId` (`null` for a root), appended after its new siblings. A no-op
 *  when the parent is unchanged or when it would form a cycle (nesting under itself or a descendant). */
export function nestTopic(topics: Topic[], id: string, parentId: string | null): Topic[] {
  const topic = topics.find((t) => t.id === id);

  if (!topic || topic.parentId === parentId) return topics;
  if (parentId !== null && subtreeIds(topics, id).includes(parentId)) return topics;

  return topics.map((t) => (t.id === id ? { ...t, parentId, order: nextOrder(topics, parentId) } : t));
}

/** Reorder a topic among its siblings by one place (`dir` -1 earlier, +1 later) by swapping orders. */
export function moveTopic(topics: Topic[], id: string, dir: -1 | 1): Topic[] {
  const topic = topics.find((t) => t.id === id);

  if (!topic) return topics;

  const siblings = childrenOf(topics, topic.parentId);
  const swap = siblings[siblings.findIndex((t) => t.id === id) + dir];

  if (!swap) return topics;

  return topics.map((t) => {
    if (t.id === topic.id) return { ...t, order: swap.order };
    if (t.id === swap.id) return { ...t, order: topic.order };

    return t;
  });
}
