import { useState } from "react";
import type { JSX } from "react";

import { boardsInTopic } from "../boards/operations";
import type { Board } from "../boards/types";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Input } from "../ui/Input";
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
import type { Topic, TopicBlock } from "./types";

// Editing a topic, mirroring BoardView → BoardEditor: a working draft of the title and the document's
// blocks, committed on Done. The block list interleaves markdown prose (edited in place) with board
// groups, each reorderable and removable. Members come from the live boards prop, never copied into
// the draft, so an immediate unfile drops a board from every picker at once. An unfile commits straight
// to the board store, so Cancel does not revert it — it only discards the blocks/title draft. Where a
// topic sits in the tree (its parent) is a structural concern handled in the sidebar, not here.
type TopicEditorProps = {
  topic: Topic;
  /** Every board, so the editor derives this topic's members live (never copying them into the draft). */
  boards: readonly Board[];
  onDone: (patch: { title: string; blocks: TopicBlock[] }) => void;
  onCancel: () => void;
  onDelete: () => void;
  onUnfileBoard: (boardId: string) => void;
};

export function TopicEditor({
  topic,
  boards,
  onDone,
  onCancel,
  onDelete,
  onUnfileBoard,
}: TopicEditorProps): JSX.Element {
  const [title, setTitle] = useState(topic.title);
  const [blocks, setBlocks] = useState<TopicBlock[]>(topic.blocks);

  const members = boardsInTopic(boards, topic.id);

  return (
    <section className="mx-auto flex w-full max-w-[1320px] flex-col gap-[clamp(0.75rem,2vh,1.25rem)] animate-rise motion-reduce:animate-none">
      <div className="flex items-center gap-4">
        <Button variant="text" onClick={onCancel}>
          Cancel
        </Button>
        <Input
          variant="title"
          value={title}
          placeholder="Untitled topic"
          aria-label="Topic title"
          onChange={(event) => setTitle(event.target.value)}
        />
        <Button variant="danger" onClick={onDelete}>
          Delete
        </Button>
        <Button variant="primary" onClick={() => onDone({ title, blocks })}>
          Done
        </Button>
      </div>

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
                  members={members}
                  reserved={
                    new Set(blocks.flatMap((b) => (b.kind === "boards" && b.id !== block.id ? b.boardIds : [])))
                  }
                  onChange={(boardIds) => setBlocks((prev) => setBlockBoards(prev, block.id, boardIds))}
                  onUnfile={onUnfileBoard}
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
