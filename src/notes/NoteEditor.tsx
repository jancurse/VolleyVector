import { useState } from "react";
import type { JSX } from "react";

import type { Board } from "../boards/types";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Input } from "../ui/Input";
import { cx, PAGE_WIDTH } from "../ui/styles";
import { BoardGroupBlock } from "./BoardGroupBlock";
import {
  appendBlock,
  makeBoardsBlock,
  makeMarkdownBlock,
  moveBlock,
  removeBlock,
  setBlockBoards,
  setBlockText,
} from "./operations";
import { TextBlockEditor } from "./TextBlockEditor";
import type { Note, NoteBlock } from "./types";

// Editing a note, mirroring BoardView → BoardEditor: a working draft of the title and the document's
// blocks, committed on Done. The block list interleaves markdown prose (edited in place) with board
// groups, each reorderable and removable. A board group's ids are the note's board links, so adding
// and removing boards here is how a board joins or leaves the note — nothing on the board changes.
// Where a note sits in the tree (its parent) is a structural concern handled in the sidebar, not here.
type NoteEditorProps = {
  note: Note;
  /** Every board of the active space — all of them addable to a board group. */
  boards: readonly Board[];
  /** Commit the draft. Resolves to null on success (the editor then closes), or to an error message —
   *  the editor stays open with the draft intact and Done retries. */
  onDone: (patch: { title: string; blocks: NoteBlock[] }) => Promise<string | null>;
  onCancel: () => void;
};

export function NoteEditor({ note, boards, onDone, onCancel }: NoteEditorProps): JSX.Element {
  const [title, setTitle] = useState(note.title);
  const [blocks, setBlocks] = useState<NoteBlock[]>(note.blocks);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const done = async () => {
    setSaving(true);
    setSaveError(null);

    const error = await onDone({ title, blocks });

    setSaving(false);
    if (error !== null) setSaveError(error);
  };

  return (
    <section
      className={cx(
        "mx-auto flex",
        PAGE_WIDTH,
        "flex-col gap-[clamp(0.75rem,2vh,1.25rem)] animate-rise motion-reduce:animate-none"
      )}
    >
      <div className="flex items-center gap-4">
        <Input
          variant="title"
          value={title}
          placeholder="Untitled note"
          aria-label="Note title"
          onChange={(event) => setTitle(event.target.value)}
        />
        <Button variant="text" paired onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" disabled={saving} onClick={() => void done()}>
          {saving ? "Saving…" : "Done"}
        </Button>
      </div>

      {saveError && (
        <p role="alert" className="text-sm text-danger">
          Couldn’t save: {saveError}. Your changes are still here — press Done to retry.
        </p>
      )}

      <div className="flex w-full max-w-[860px] flex-col gap-4">
        <div className="flex flex-col gap-4">
          {blocks.map((block, index) => (
            <div key={block.id} className="flex flex-col gap-3 rounded-xl border border-border bg-panel p-4">
              <div className="flex items-center gap-1">
                <IconButton
                  variant="control"
                  size="sm"
                  aria-label={`Move block ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => setBlocks((prev) => moveBlock(prev, block.id, -1))}
                >
                  ↑
                </IconButton>
                <IconButton
                  variant="control"
                  size="sm"
                  aria-label={`Move block ${index + 1} down`}
                  disabled={index === blocks.length - 1}
                  onClick={() => setBlocks((prev) => moveBlock(prev, block.id, 1))}
                >
                  ↓
                </IconButton>
                <Button
                  variant="danger"
                  size="sm"
                  className="ml-auto"
                  aria-label={`Remove block ${index + 1}`}
                  onClick={() => setBlocks((prev) => removeBlock(prev, block.id))}
                >
                  Remove
                </Button>
              </div>

              {block.kind === "markdown" ? (
                <TextBlockEditor
                  value={block.text}
                  onChange={(text) => setBlocks((prev) => setBlockText(prev, block.id, text))}
                />
              ) : (
                <BoardGroupBlock
                  boardIds={block.boardIds}
                  boards={boards}
                  reserved={
                    new Set(blocks.flatMap((b) => (b.kind === "boards" && b.id !== block.id ? b.boardIds : [])))
                  }
                  onChange={(boardIds) => setBlocks((prev) => setBlockBoards(prev, block.id, boardIds))}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            variant="dashed"
            size="sm"
            onClick={() => setBlocks((prev) => appendBlock(prev, makeMarkdownBlock()))}
          >
            + Text block
          </Button>
          <Button variant="dashed" size="sm" onClick={() => setBlocks((prev) => appendBlock(prev, makeBoardsBlock()))}>
            + Board group
          </Button>
        </div>
      </div>
    </section>
  );
}
