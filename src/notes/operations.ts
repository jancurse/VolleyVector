import { uniqueSlug } from "../routing/slug";
import type { Note, NoteBlock } from "./types";

// Pure transforms over the note tree. Nesting lives in `parentId` and order in `order` among
// siblings, so every operation works on those two fields. Nothing here touches storage, the DOM, or
// a board — a note only references boards from its blocks, so no tree operation can affect a board.

function newId(): string {
  return crypto.randomUUID();
}

/** A parent's direct children in their manual order. Pass `null` for the top-level (root) notes. */
export function childrenOf(notes: readonly Note[], parentId: string | null): Note[] {
  return notes.filter((t) => t.parentId === parentId).sort((a, b) => a.order - b.order);
}

/** A note's id plus every descendant id — for cascade deletes and cycle guards. */
export function subtreeIds(notes: readonly Note[], id: string): string[] {
  return [id, ...notes.filter((t) => t.parentId === id).flatMap((child) => subtreeIds(notes, child.id))];
}

/** A note paired with its depth in the tree, in depth-first sibling order. */
export type FlatNote = { note: Note; depth: number };

/** Flatten the tree depth-first, tagging each note with its depth — for the picker and the sidebar. */
export function flattenNotes(notes: readonly Note[], parentId: string | null = null, depth = 0): FlatNote[] {
  return childrenOf(notes, parentId).flatMap((note) => [{ note, depth }, ...flattenNotes(notes, note.id, depth + 1)]);
}

function nextOrder(notes: readonly Note[], parentId: string | null): number {
  return notes.filter((t) => t.parentId === parentId).reduce((max, t) => Math.max(max, t.order), -1) + 1;
}

/** Add a note under `parentId` (`null` for a root), appended after its siblings. */
export function createNote(
  notes: readonly Note[],
  parentId: string | null,
  title = "New note"
): { notes: Note[]; id: string } {
  const note: Note = {
    id: newId(),
    title,
    slug: uniqueSlug(
      title,
      notes.map((t) => t.slug)
    ),
    blocks: [],
    parentId,
    order: nextOrder(notes, parentId),
    capability: "owner",
    currentRevisionId: null,
  };

  return { notes: [...notes, note], id: note.id };
}

/** Patch a note's editable fields (title, blocks, slug). */
export function setNote(
  notes: readonly Note[],
  id: string,
  patch: Partial<Pick<Note, "title" | "blocks" | "slug" | "currentRevisionId">>
): Note[] {
  return notes.map((t) => (t.id === id ? { ...t, ...patch } : t));
}

/** Remove a note and its whole subtree. Boards they reference are untouched. */
export function deleteNote(notes: readonly Note[], id: string): Note[] {
  const removed = new Set(subtreeIds(notes, id));

  return notes.filter((t) => !removed.has(t.id));
}

/** Re-parent a note under `parentId` (`null` for a root), appended after its new siblings. A no-op
 *  when the parent is unchanged or when it would form a cycle (nesting under itself or a descendant). */
export function nestNote(notes: Note[], id: string, parentId: string | null): Note[] {
  const note = notes.find((t) => t.id === id);

  if (!note || note.parentId === parentId) return notes;
  if (parentId !== null && subtreeIds(notes, id).includes(parentId)) return notes;

  return notes.map((t) => (t.id === id ? { ...t, parentId, order: nextOrder(notes, parentId) } : t));
}

/** Reorder a note among its siblings by one place (`dir` -1 earlier, +1 later) by swapping orders. */
export function moveNote(notes: Note[], id: string, dir: -1 | 1): Note[] {
  const note = notes.find((t) => t.id === id);

  if (!note) return notes;

  const siblings = childrenOf(notes, note.parentId);
  const swap = siblings[siblings.findIndex((t) => t.id === id) + dir];

  if (!swap) return notes;

  return notes.map((t) => {
    if (t.id === note.id) return { ...t, order: swap.order };
    if (t.id === swap.id) return { ...t, order: note.order };

    return t;
  });
}

// Pure transforms over a note's block list. A note's document is an ordered `NoteBlock[]`; these
// build, edit, reorder, and remove its blocks. A `boards` block's ids are the one source of truth for
// which boards the note references, so editing blocks IS editing the note's board links.

/** The board ids a note references, in block order, each at most once. */
export function boardIdsOf(note: Note): string[] {
  return [...new Set(note.blocks.flatMap((b) => (b.kind === "boards" ? b.boardIds : [])))];
}

/** The notes whose blocks reference `boardId` — the board's "appears in" backlinks, in tree order. */
export function notesReferencing(notes: readonly Note[], boardId: string): Note[] {
  return flattenNotes(notes)
    .map(({ note }) => note)
    .filter((t) => boardIdsOf(t).includes(boardId));
}

/** Append `boardId` to the last board-group block, or to a fresh one when the document has none. A
 *  no-op when some block already references it. */
export function appendBoardToBlocks(blocks: readonly NoteBlock[], boardId: string): NoteBlock[] {
  if (blocks.some((b) => b.kind === "boards" && b.boardIds.includes(boardId))) return [...blocks];

  const last = [...blocks].reverse().find((b) => b.kind === "boards");

  if (!last || last.kind !== "boards") return appendBlock(blocks, makeBoardsBlock([boardId]));

  return setBlockBoards(blocks, last.id, [...last.boardIds, boardId]);
}

/** A fresh markdown block holding `text` (empty by default). */
export function makeMarkdownBlock(text = ""): NoteBlock {
  return { id: newId(), kind: "markdown", text };
}

/** A fresh board-group block referencing `boardIds` (none by default). */
export function makeBoardsBlock(boardIds: readonly string[] = []): NoteBlock {
  return { id: newId(), kind: "boards", boardIds: [...boardIds] };
}

/** Append a block to the end of the list. */
export function appendBlock(blocks: readonly NoteBlock[], block: NoteBlock): NoteBlock[] {
  return [...blocks, block];
}

/** Set a markdown block's text, leaving any other block (and board-group blocks) untouched. */
export function setBlockText(blocks: readonly NoteBlock[], id: string, text: string): NoteBlock[] {
  return blocks.map((b) => (b.id === id && b.kind === "markdown" ? { ...b, text } : b));
}

/** Set a board-group block's `boardIds`, leaving any other block (and markdown blocks) untouched. */
export function setBlockBoards(blocks: readonly NoteBlock[], id: string, boardIds: readonly string[]): NoteBlock[] {
  return blocks.map((b) => (b.id === id && b.kind === "boards" ? { ...b, boardIds: [...boardIds] } : b));
}

/** Reorder a block by one place (`dir` -1 earlier, +1 later) by swapping with its neighbour. */
export function moveBlock(blocks: readonly NoteBlock[], id: string, dir: -1 | 1): NoteBlock[] {
  const index = blocks.findIndex((b) => b.id === id);
  const swap = index + dir;

  if (index === -1 || swap < 0 || swap >= blocks.length) return [...blocks];

  const next = [...blocks];

  [next[index], next[swap]] = [next[swap], next[index]];

  return next;
}

/** Remove a block from the list. */
export function removeBlock(blocks: readonly NoteBlock[], id: string): NoteBlock[] {
  return blocks.filter((b) => b.id !== id);
}
