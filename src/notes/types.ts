// A Note is one node in the coach-curated tree that organises the library. Notes nest to arbitrary
// depth through a nullable parent, and each reads as a document: an ordered list of blocks that
// interleave markdown prose with groups of board cards. A `boards` block's ids ARE the links: they are
// the one source of truth for which boards a note references. Any number of notes may reference the
// same board, and a board referenced by none simply lives in All Boards alone.

import type { Capability } from "../supabase/rows";

/** One block in a note's document: markdown prose, or a group of board cards. */
export type NoteBlock =
  | { id: string; kind: "markdown"; text: string }
  | { id: string; kind: "boards"; boardIds: string[] };

export type Note = {
  id: string;
  title: string;
  /** The note's URL handle: minted once at creation, stable across renames. */
  slug: string;
  /** The note's document: markdown and board-group blocks in the coach's chosen order. */
  blocks: NoteBlock[];
  /** Parent note id, or null for a top-level (root) note. */
  parentId: string | null;
  /** Manual order among its siblings (the notes that share its parent). */
  order: number;
  /** The viewer's own access on this note: viewer, editor, or owner; derived, never stored. */
  capability: Capability;
  /** The revision this note's content matches; the base for the next commit's conflict check. */
  currentRevisionId: string | null;
};
