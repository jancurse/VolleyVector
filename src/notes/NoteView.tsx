import type { JSX, ReactNode } from "react";

import type { Board } from "../boards/types";
import { CardGrid } from "../library/CardGrid";
import { boardToItem } from "../library/items";
import { Button } from "../ui/Button";
import { Markdown } from "../ui/Markdown";
import { EYEBROW, PAGE, PAGE_BAR, TITLE } from "../ui/styles";
import { childrenOf } from "./operations";
import type { Note } from "./types";

// A note's read-only page, read as a document. A persistent subnote-link row sits under the title,
// then the note's blocks render in order: markdown as prose, a board group as a card grid of the
// boards its ids resolve to. The block ids are the note's board links themselves; an id the space's
// list does not hold (deleted, or moved away) is dropped, and a board an earlier group already shows
// is not shown twice. Opening a card opens the board.
type NoteViewProps = {
  note: Note;
  notes: readonly Note[];
  /** Every board of the active space, for resolving the blocks' board ids. */
  boards: readonly Board[];
  onOpenBoard: (id: string) => void;
  onSelectNote: (id: string) => void;
  onEdit: () => void;
  onAddSubnote: () => void;
  /** Create a board that commits into this note's document (appended to its last board group). */
  onNewBoard: () => void;
  /** Whether to offer the new-board, edit, and subnote actions (a coach of this team, or an admin). */
  canEdit: boolean;
  /** The page-bar overflow menu (the note's JSON export, print, and deletion), offered to all. */
  menu?: ReactNode;
};

const SUBTOPIC =
  "cursor-pointer rounded-pill border border-border bg-control px-[0.66rem] py-[0.28rem] font-ui text-sm font-semibold text-text-dim transition-colors duration-150 ease-settle hover:bg-control-hover hover:text-text";

export function NoteView({
  note,
  notes,
  boards,
  onOpenBoard,
  onSelectNote,
  onEdit,
  onAddSubnote,
  onNewBoard,
  canEdit,
  menu,
}: NoteViewProps): JSX.Element {
  const subnotes = childrenOf(notes, note.id);
  const byId = new Map(boards.map((b) => [b.id, b]));

  // Walk the blocks once, tracking which boards each group has already shown so none renders twice.
  const shown = new Set<string>();
  const rendered = note.blocks.map((block) => {
    if (block.kind === "markdown") {
      return block.text.trim() ? <Markdown key={block.id}>{block.text}</Markdown> : null;
    }

    const group: Board[] = [];

    for (const id of block.boardIds) {
      const board = byId.get(id);

      if (board && !shown.has(id)) {
        shown.add(id);
        group.push(board);
      }
    }

    if (group.length === 0) return null;

    return <CardGrid key={block.id} items={group.map(boardToItem)} onOpen={onOpenBoard} />;
  });

  return (
    <section className={PAGE}>
      <div className={PAGE_BAR}>
        <div>
          <p className={EYEBROW}>Note</p>
          <h1 className={TITLE}>{note.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <>
              <Button variant="ghost" onClick={onAddSubnote}>
                + Subnote
              </Button>
              <Button variant="ghost" onClick={onEdit}>
                Edit
              </Button>
            </>
          )}
          {menu}
        </div>
      </div>

      {subnotes.length > 0 && (
        <nav className="flex flex-wrap gap-[0.4rem]" aria-label="Subnotes">
          {subnotes.map((sub) => (
            <button key={sub.id} type="button" className={SUBTOPIC} onClick={() => onSelectNote(sub.id)}>
              {sub.title}
            </button>
          ))}
        </nav>
      )}

      {rendered}

      {canEdit && <CardGrid items={[]} onOpen={onOpenBoard} onNew={onNewBoard} />}
    </section>
  );
}
