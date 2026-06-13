import type { JSX } from "react";

import { stepMarkers } from "../boards/operations";
import type { Board } from "../boards/types";
import { Court } from "../court/Court";
import type { Note } from "../notes/types";
import { cx, FIELD_LABEL } from "../ui/styles";

// The preview of a parsed bundle: any leniency notices, the note tree to be created (indented by
// depth), and each board as a small static court of its first step. Shared by the import dialog and
// the dev-only draft preview route, which makes the cards clickable to inspect one board in full.
type BundlePreviewProps = {
  notes: readonly Note[];
  boards: readonly Board[];
  notices: readonly string[];
  /** When given, each board card becomes a button opening that board (by its index in `boards`). */
  onOpenBoard?: (index: number) => void;
};

const CARD = "overflow-hidden rounded-lg border border-border bg-panel";

/** Each note with its depth in the new tree, in the parents-first order the parser returns. */
function withDepths(notes: readonly Note[]): { note: Note; depth: number }[] {
  const depths = new Map<string | null, number>([[null, -1]]);

  return notes.map((note) => {
    const depth = (depths.get(note.parentId) ?? -1) + 1;

    depths.set(note.id, depth);

    return { note, depth };
  });
}

export function BundlePreview({ notes, boards, notices, onOpenBoard }: BundlePreviewProps): JSX.Element {
  return (
    <>
      {notices.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-text-dim">
          {notices.map((notice, i) => (
            <li key={i}>{notice}</li>
          ))}
        </ul>
      )}

      {notes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className={FIELD_LABEL}>Notes</p>
          {withDepths(notes).map(({ note, depth }) => (
            <p key={note.id} className="m-0 text-sm font-semibold" style={{ paddingLeft: `${depth}rem` }}>
              {note.title}
            </p>
          ))}
        </div>
      )}

      {boards.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className={FIELD_LABEL}>Boards</p>
          <div className="grid grid-cols-2 gap-3">
            {boards.map((board, index) => {
              const card = (
                <>
                  <div className="aspect-square w-full bg-court-surface" aria-hidden="true">
                    <Court markers={stepMarkers(board, 0)} annotations={board.steps[0].annotations} />
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="m-0 text-sm font-semibold">{board.title}</p>
                    <p className="m-0 font-mono text-2xs text-text-dim">
                      {board.steps.length === 1 ? "Position" : `Sequence · ${board.steps.length} steps`}
                    </p>
                  </div>
                </>
              );

              return onOpenBoard ? (
                <button
                  key={board.id}
                  type="button"
                  className={cx(
                    CARD,
                    "cursor-pointer p-0 text-left transition-colors duration-150 hover:border-accent"
                  )}
                  onClick={() => onOpenBoard(index)}
                >
                  {card}
                </button>
              ) : (
                <div key={board.id} className={CARD}>
                  {card}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
