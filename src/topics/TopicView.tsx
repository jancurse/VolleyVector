import type { JSX } from "react";

import { BoardGrid } from "../library/BoardGrid";
import { boardToItem } from "../library/items";
import type { Board } from "../boards/types";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Markdown } from "../ui/Markdown";
import { EYEBROW, MUTED, PAGE, PAGE_BAR, TITLE } from "../ui/styles";
import { childrenOf } from "./operations";
import type { Topic } from "./types";

// A topic's read-only page, mirroring BoardView's view-first shape: the topic's markdown explanation
// at the top, its subtopics as links, then the grid of boards filed directly in it (never its
// descendants'). A coach reorders or removes those boards from each card, and reaches Edit, add a
// subtopic, from the bar. Subtopics are reached through their links and the sidebar, not folded in.
type TopicViewProps = {
  topic: Topic;
  topics: readonly Topic[];
  /** Boards filed directly in this topic, in manual order. */
  boards: readonly Board[];
  onOpenBoard: (id: string) => void;
  onSelectTopic: (id: string) => void;
  onEdit: () => void;
  onAddSubtopic: () => void;
  onMoveBoard: (boardId: string, dir: -1 | 1) => void;
  onRemoveBoard: (boardId: string) => void;
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
  onMoveBoard,
  onRemoveBoard,
}: TopicViewProps): JSX.Element {
  const subtopics = childrenOf(topics, topic.id);
  const items = boards.map(boardToItem);
  const firstId = boards[0]?.id;
  const lastId = boards[boards.length - 1]?.id;

  return (
    <section className={PAGE}>
      <div className={PAGE_BAR}>
        <div>
          <p className={EYEBROW}>Topic</p>
          <h1 className={TITLE}>{topic.title}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onAddSubtopic}>
            + Subtopic
          </Button>
          <Button variant="primary" onClick={onEdit}>
            Edit
          </Button>
        </div>
      </div>

      {topic.body.trim() ? <Markdown>{topic.body}</Markdown> : <p className={MUTED}>No explanation yet.</p>}

      {subtopics.length > 0 && (
        <nav className="flex flex-wrap gap-[0.4rem]" aria-label="Subtopics">
          {subtopics.map((sub) => (
            <button key={sub.id} type="button" className={SUBTOPIC} onClick={() => onSelectTopic(sub.id)}>
              {sub.title}
            </button>
          ))}
        </nav>
      )}

      <BoardGrid
        items={items}
        onOpen={onOpenBoard}
        emptyLabel="No boards in this topic yet."
        cardControls={(item) => (
          <>
            <IconButton
              variant="control"
              size="sm"
              aria-label={`Move ${item.title} up`}
              disabled={item.id === firstId}
              onClick={() => onMoveBoard(item.id, -1)}
            >
              ↑
            </IconButton>
            <IconButton
              variant="control"
              size="sm"
              aria-label={`Move ${item.title} down`}
              disabled={item.id === lastId}
              onClick={() => onMoveBoard(item.id, 1)}
            >
              ↓
            </IconButton>
            <Button
              variant="danger"
              size="sm"
              className="ml-auto"
              onClick={() => onRemoveBoard(item.id)}
              aria-label={`Remove ${item.title} from topic`}
            >
              Remove
            </Button>
          </>
        )}
      />
    </section>
  );
}
