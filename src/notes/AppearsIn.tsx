import type { JSX } from "react";
import { Plus } from "lucide-react";

import { Menu, MenuItem } from "../ui/Menu";
import { flattenNotes, notesReferencing } from "./operations";
import type { Note } from "./types";

// The quiet backlinks row under a board's title: the notes whose documents reference this board, each
// a link, plus (for a curator) an add action that appends the board to the end of a chosen note's
// document. A board belongs to no note by itself, so with no backlinks and no add action there is
// nothing to say and the row renders nothing.
type AppearsInProps = {
  boardId: string;
  notes: readonly Note[];
  onOpenNote: (id: string) => void;
  /** Append the board to a note's document — offered to the space's curators only. */
  onAddToNote?: (noteId: string) => void;
};

const NOTE_LINK =
  "cursor-pointer border-0 bg-transparent p-0 font-ui text-sm font-semibold text-text-dim underline decoration-border underline-offset-4 transition-colors duration-150 ease-settle hover:text-text hover:decoration-current";
const ADD_LINK =
  "flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-ui text-sm font-medium text-text-dim transition-colors duration-150 ease-settle hover:text-text";

export function AppearsIn({ boardId, notes, onOpenNote, onAddToNote }: AppearsInProps): JSX.Element | null {
  const linked = notesReferencing(notes, boardId);
  const addable = onAddToNote ? flattenNotes(notes).filter(({ note }) => !linked.includes(note)) : [];

  if (linked.length === 0 && addable.length === 0) return null;

  return (
    <nav aria-label="Appears in" className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="font-mono text-2xs font-medium uppercase tracking-[0.16em] text-text-dim">Appears in</span>
      {linked.map((note) => (
        <button key={note.id} type="button" className={NOTE_LINK} onClick={() => onOpenNote(note.id)}>
          {note.title || "Untitled note"}
        </button>
      ))}
      {addable.length > 0 && (
        <Menu
          tooltip="Add this board to a note"
          trigger={
            <button type="button" className={ADD_LINK}>
              <Plus size={13} aria-hidden="true" />
              {linked.length > 0 ? <span className="sr-only">Add to note</span> : "Add to note"}
            </button>
          }
        >
          {addable.map(({ note, depth }) => (
            <MenuItem key={note.id} onClick={() => onAddToNote?.(note.id)}>
              <span style={{ paddingLeft: `${depth * 0.75}rem` }}>{note.title || "Untitled note"}</span>
            </MenuItem>
          ))}
        </Menu>
      )}
    </nav>
  );
}
