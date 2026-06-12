import type { JSX } from "react";

import type { Board } from "../boards/types";
import type { Note } from "../notes/types";
import { Markdown } from "../ui/Markdown";
import { EYEBROW } from "../ui/styles";
import { BoardPrint } from "./BoardPrint";

// A note as a printable document: its title, then its blocks in order — prose as-is, and each board
// group's links expanded through BoardPrint. Like NoteView, the block ids are the links themselves: an
// id the space's list does not hold is dropped, and a board an earlier group already printed is not
// printed twice.
type NotePrintProps = {
  note: Note;
  /** Every board of the active space, for resolving the blocks' board ids. */
  boards: readonly Board[];
};

export function NotePrint({ note, boards }: NotePrintProps): JSX.Element {
  const byId = new Map(boards.map((b) => [b.id, b]));
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

    return group.map((board) => <BoardPrint key={board.id} board={board} />);
  });

  return (
    <article className="flex flex-col gap-8">
      <header className="break-inside-avoid break-after-avoid">
        <p className={EYEBROW}>Note</p>
        <h1 className="m-0 font-display text-[2.1rem] font-bold leading-[1.05] tracking-[-0.025em]">{note.title}</h1>
      </header>
      {rendered}
    </article>
  );
}
