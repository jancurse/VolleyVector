import type { JSX } from "react";

import type { Board } from "../boards/types";
import { CardGrid } from "../library/CardGrid";
import { boardToItem } from "../library/items";
import { Button } from "../ui/Button";
import { Markdown } from "../ui/Markdown";
import { EYEBROW, PAGE, PAGE_BAR, TITLE } from "../ui/styles";
import { childrenOf } from "./operations";
import type { Topic } from "./types";

// A topic's read-only page, read as a document. A persistent subtopic-link row sits under the title,
// then the topic's blocks render in order: markdown as prose, a board group as a card grid. Board
// groups carry only placement, so each is intersected with the topic's real members (the boards prop)
// and a board already shown by an earlier group is dropped. Any member no block placed trails in a
// final grid, so a filed board can never disappear. Opening a card opens the board.
type TopicViewProps = {
  topic: Topic;
  topics: readonly Topic[];
  /** Boards filed directly in this topic, newest first. */
  boards: readonly Board[];
  onOpenBoard: (id: string) => void;
  onSelectTopic: (id: string) => void;
  onEdit: () => void;
  onAddSubtopic: () => void;
  /** Create a board pre-filed into this topic. */
  onNewBoard: () => void;
  /** Whether to offer the new-board, edit, and subtopic actions (a coach of this team, or an admin). */
  canEdit: boolean;
};

const SUBTOPIC =
  "cursor-pointer rounded-pill border border-border bg-control px-[0.66rem] py-[0.28rem] font-ui text-sm font-semibold text-text-dim transition-colors duration-150 ease-settle hover:bg-control-hover hover:text-text";

export function TopicView({
  topic,
  topics,
  boards,
  onOpenBoard,
  onSelectTopic,
  onEdit,
  onAddSubtopic,
  onNewBoard,
  canEdit,
}: TopicViewProps): JSX.Element {
  const subtopics = childrenOf(topics, topic.id);
  const byId = new Map(boards.map((b) => [b.id, b]));

  // Walk the blocks once, tracking which boards each group has already shown so none renders twice.
  const shown = new Set<string>();
  const rendered = topic.blocks.map((block) => {
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

  const unplaced = boards.filter((b) => !shown.has(b.id));

  return (
    <section className={PAGE}>
      <div className={PAGE_BAR}>
        <div>
          <p className={EYEBROW}>Topic</p>
          <h1 className={TITLE}>{topic.title}</h1>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={onAddSubtopic}>
              + Subtopic
            </Button>
            <Button variant="ghost" onClick={onEdit}>
              Edit
            </Button>
          </div>
        )}
      </div>

      {subtopics.length > 0 && (
        <nav className="flex flex-wrap gap-[0.4rem]" aria-label="Subtopics">
          {subtopics.map((sub) => (
            <button key={sub.id} type="button" className={SUBTOPIC} onClick={() => onSelectTopic(sub.id)}>
              {sub.title}
            </button>
          ))}
        </nav>
      )}

      {rendered}

      {(unplaced.length > 0 || canEdit) && (
        <CardGrid items={unplaced.map(boardToItem)} onOpen={onOpenBoard} onNew={canEdit ? onNewBoard : undefined} />
      )}
    </section>
  );
}
