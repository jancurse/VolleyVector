import { uniqueSlug } from "../routing/slug";
import type { Topic, TopicBlock } from "./types";

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
  const topic: Topic = {
    id: newId(),
    title,
    slug: uniqueSlug(
      title,
      topics.map((t) => t.slug)
    ),
    blocks: [],
    parentId,
    order: nextOrder(topics, parentId),
  };

  return { topics: [...topics, topic], id: topic.id };
}

/** Patch a topic's editable fields (title, blocks, slug). */
export function setTopic(
  topics: readonly Topic[],
  id: string,
  patch: Partial<Pick<Topic, "title" | "blocks" | "slug">>
): Topic[] {
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

// Pure transforms over a topic's block list. A topic's document is an ordered `TopicBlock[]`; these
// build, edit, reorder, and remove its blocks. They never touch board membership — a `boards` block
// only records placement, intersected with the topic's real members where it renders.

/** A fresh markdown block holding `text` (empty by default). */
export function makeMarkdownBlock(text = ""): TopicBlock {
  return { id: newId(), kind: "markdown", text };
}

/** A fresh board-group block referencing `boardIds` (none by default). */
export function makeBoardsBlock(boardIds: readonly string[] = []): TopicBlock {
  return { id: newId(), kind: "boards", boardIds: [...boardIds] };
}

/** Append a block to the end of the list. */
export function appendBlock(blocks: readonly TopicBlock[], block: TopicBlock): TopicBlock[] {
  return [...blocks, block];
}

/** Set a markdown block's text, leaving any other block (and board-group blocks) untouched. */
export function setBlockText(blocks: readonly TopicBlock[], id: string, text: string): TopicBlock[] {
  return blocks.map((b) => (b.id === id && b.kind === "markdown" ? { ...b, text } : b));
}

/** Set a board-group block's `boardIds`, leaving any other block (and markdown blocks) untouched. */
export function setBlockBoards(blocks: readonly TopicBlock[], id: string, boardIds: readonly string[]): TopicBlock[] {
  return blocks.map((b) => (b.id === id && b.kind === "boards" ? { ...b, boardIds: [...boardIds] } : b));
}

/** Reorder a block by one place (`dir` -1 earlier, +1 later) by swapping with its neighbour. */
export function moveBlock(blocks: readonly TopicBlock[], id: string, dir: -1 | 1): TopicBlock[] {
  const index = blocks.findIndex((b) => b.id === id);
  const swap = index + dir;

  if (index === -1 || swap < 0 || swap >= blocks.length) return [...blocks];

  const next = [...blocks];

  [next[index], next[swap]] = [next[swap], next[index]];

  return next;
}

/** Remove a block from the list. */
export function removeBlock(blocks: readonly TopicBlock[], id: string): TopicBlock[] {
  return blocks.filter((b) => b.id !== id);
}
