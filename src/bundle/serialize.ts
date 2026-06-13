import type { Board } from "../boards/types";
import { childrenOf } from "../notes/operations";
import type { Note } from "../notes/types";
import { slugify } from "../routing/slug";
import type { Bundle, BundleBoard, BundleNote } from "./types";
import { FORMAT_VERSION } from "./types";

// Builds a bundle from a set of boards and notes — one board, a note subtree with the boards it
// references, or a whole space. Real ids become the ref values, server-owned fields are dropped, and
// references leaving the set (a subtree root's parent, a board ref outside it) are nulled or filtered
// so every ref resolves.

/** The included notes parents-first, siblings in manual order — the order a reader (and import) wants. */
function orderedNotes(notes: readonly Note[]): Note[] {
  const included = new Set(notes.map((t) => t.id));
  const roots = notes.filter((t) => t.parentId === null || !included.has(t.parentId)).sort((a, b) => a.order - b.order);
  const walk = (list: readonly Note[]): Note[] => list.flatMap((t) => [t, ...walk(childrenOf(notes, t.id))]);

  return walk(roots);
}

/** Serialize boards and notes into a portable bundle. */
export function toBundle(boards: readonly Board[], notes: readonly Note[]): Bundle {
  const boardIds = new Set(boards.map((b) => b.id));

  const bundleNotes: BundleNote[] = orderedNotes(notes).map((t) => ({
    ref: t.id,
    title: t.title,
    parentRef: t.parentId !== null && notes.some((p) => p.id === t.parentId) ? t.parentId : null,
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
      ...(s.rotation && { rotation: s.rotation }),
    })),
    description: b.description,
    tags: b.tags,
    autoArrows: b.autoArrows,
    rotationStrict: b.rotationStrict,
  }));

  return { formatVersion: FORMAT_VERSION, notes: bundleNotes, boards: bundleBoards };
}

/** The download filename for a bundle exported under `title`, e.g. "serve-receive.json". */
export function bundleFilename(title: string): string {
  return `${slugify(title)}.json`;
}
