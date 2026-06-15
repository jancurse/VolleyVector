import { useState } from "react";
import type { JSX } from "react";

import type { Board } from "../boards/types";
import { CardGrid } from "../library/CardGrid";
import { boardToItem } from "../library/items";
import type { Note } from "../notes/types";
import { Button } from "../ui/Button";
import { Markdown } from "../ui/Markdown";
import { EYEBROW, MUTED, PAGE, PAGE_BAR, TITLE } from "../ui/styles";
import { RevisionList } from "./RevisionList";
import { useNoteRevisions } from "./useRevisions";

// A note's history: the revision list beside a read-only preview of the selected revision's document. The
// preview renders the note's blocks the same way its page does (prose, and board groups as card grids),
// resolving board ids against the live space. Restore commits a past revision's content as a new revision.
type NoteHistoryProps = {
  note: Note;
  /** Every board of the active space, for resolving the blocks' board ids. */
  boards: readonly Board[];
  onBack: () => void;
  onOpenBoard: (id: string) => void;
  /** Commit a past revision's content as a new revision; absent when the viewer may not edit the note. */
  onRestore?: (snapshot: Note) => void;
};

const LAYOUT =
  "mx-auto grid w-full max-w-[1100px] grid-cols-[20rem_minmax(0,1fr)] items-start gap-[clamp(1rem,3vw,2rem)] max-[900px]:grid-cols-[minmax(0,1fr)]";

// The blocks of one note revision, read-only: markdown as prose, a board group as a card grid of the boards
// its ids resolve to, with each board shown at most once (the note page's own rule).
function NotePreview({
  note,
  boards,
  onOpenBoard,
}: {
  note: Note;
  boards: readonly Board[];
  onOpenBoard: (id: string) => void;
}): JSX.Element {
  const byId = new Map(boards.map((b) => [b.id, b]));
  const shown = new Set<string>();

  return (
    <>
      {note.blocks.map((block) => {
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

        return group.length > 0 ? (
          <CardGrid key={block.id} items={group.map(boardToItem)} onOpen={onOpenBoard} />
        ) : null;
      })}
    </>
  );
}

export function NoteHistory({ note, boards, onBack, onOpenBoard, onRestore }: NoteHistoryProps): JSX.Element {
  const { entries, loading, error } = useNoteRevisions(note);
  const [picked, setPicked] = useState<string | null>(null);

  const selectedId = picked ?? note.currentRevisionId ?? entries[0]?.id ?? null;
  const selected = entries.find((e) => e.id === selectedId);
  const preview = selected?.note ?? note;

  const restore = (id: string) => {
    const entry = entries.find((e) => e.id === id);

    if (entry && onRestore) onRestore(entry.note);
  };

  return (
    <div className={LAYOUT}>
      <RevisionList
        revisions={entries}
        selectedId={selectedId}
        currentId={note.currentRevisionId}
        onSelect={setPicked}
        onRestore={onRestore ? restore : undefined}
        loading={loading}
        error={error}
      />
      <section className={PAGE}>
        <div className={PAGE_BAR}>
          <div>
            <p className={EYEBROW}>Note revision</p>
            <h1 className={TITLE}>{preview.title}</h1>
          </div>
          <Button variant="text" size="sm" onClick={onBack}>
            ← Back to note
          </Button>
        </div>
        {preview.blocks.length > 0 ? (
          <NotePreview note={preview} boards={boards} onOpenBoard={onOpenBoard} />
        ) : (
          <p className={MUTED}>This revision has no content.</p>
        )}
      </section>
    </div>
  );
}
