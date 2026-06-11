import type { Board } from "../boards/types";
import { slugify } from "../routing/slug";
import { childrenOf } from "../topics/operations";
import type { Topic } from "../topics/types";
import type { Bundle, BundleBoard, BundleTopic } from "./types";
import { FORMAT_VERSION } from "./types";

// Builds a bundle from a set of boards and topics — one board, a topic subtree with its members, or a
// whole space. Real ids become the ref values, server-owned fields are dropped, and references leaving
// the set (a subtree root's parent, a stale board hint) are nulled or filtered so every ref resolves.

/** The included topics parents-first, siblings in manual order — the order a reader (and import) wants. */
function orderedTopics(topics: readonly Topic[]): Topic[] {
  const included = new Set(topics.map((t) => t.id));
  const roots = topics
    .filter((t) => t.parentId === null || !included.has(t.parentId))
    .sort((a, b) => a.order - b.order);
  const walk = (list: readonly Topic[]): Topic[] => list.flatMap((t) => [t, ...walk(childrenOf(topics, t.id))]);

  return walk(roots);
}

/** Serialize boards and topics into a portable bundle. */
export function toBundle(boards: readonly Board[], topics: readonly Topic[]): Bundle {
  const topicIds = new Set(topics.map((t) => t.id));
  const boardIds = new Set(boards.map((b) => b.id));

  const bundleTopics: BundleTopic[] = orderedTopics(topics).map((t) => ({
    ref: t.id,
    title: t.title,
    parentRef: t.parentId !== null && topicIds.has(t.parentId) ? t.parentId : null,
    blocks: t.blocks.map((block) =>
      block.kind === "markdown"
        ? { kind: "markdown", text: block.text }
        : { kind: "boards", boardRefs: block.boardIds.filter((id) => boardIds.has(id)) }
    ),
  }));

  const bundleBoards: BundleBoard[] = boards.map((b) => ({
    ref: b.id,
    title: b.title,
    mode: b.mode,
    markers: b.markers.map((m) => ({
      id: m.id,
      role: m.role,
      ...(m.label !== undefined && { label: m.label }),
      ...(m.color !== undefined && { color: m.color }),
    })),
    steps: b.steps.map((s) => ({
      instruction: s.instruction,
      positions: s.positions,
      ...(s.annotations?.length ? { annotations: s.annotations } : {}),
    })),
    topicRef: b.topicId !== null && topicIds.has(b.topicId) ? b.topicId : null,
    description: b.description,
    tags: b.tags,
    autoArrows: b.autoArrows,
  }));

  return { formatVersion: FORMAT_VERSION, topics: bundleTopics, boards: bundleBoards };
}

/** The download filename for a bundle exported under `title`, e.g. "serve-receive.json". */
export function bundleFilename(title: string): string {
  return `${slugify(title)}.json`;
}
