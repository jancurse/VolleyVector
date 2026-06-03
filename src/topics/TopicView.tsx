import type { JSX } from "react";
import ReactMarkdown from "react-markdown";

import { BoardGrid } from "../library/BoardGrid";
import { boardToItem } from "../library/items";
import type { Board } from "../boards/types";
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
    <section className="vc-library-page vc-topic-page">
      <div className="vc-library-bar">
        <div className="vc-caption">
          <p className="vc-eyebrow">Topic</p>
          <h1 className="vc-view-title">{topic.title}</h1>
        </div>
        <div className="vc-new-group">
          <button type="button" className="vc-new" onClick={onAddSubtopic}>
            + Subtopic
          </button>
          <button type="button" className="vc-primary" onClick={onEdit}>
            Edit
          </button>
        </div>
      </div>

      {topic.body.trim() ? (
        <div className="vc-markdown vc-topic-body">
          <ReactMarkdown>{topic.body}</ReactMarkdown>
        </div>
      ) : (
        <p className="vc-muted">No explanation yet.</p>
      )}

      {subtopics.length > 0 && (
        <nav className="vc-topic-subs" aria-label="Subtopics">
          {subtopics.map((sub) => (
            <button key={sub.id} type="button" className="vc-tag-toggle" onClick={() => onSelectTopic(sub.id)}>
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
            <button
              type="button"
              className="vc-card-ctrl"
              aria-label={`Move ${item.title} up`}
              disabled={item.id === firstId}
              onClick={() => onMoveBoard(item.id, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="vc-card-ctrl"
              aria-label={`Move ${item.title} down`}
              disabled={item.id === lastId}
              onClick={() => onMoveBoard(item.id, 1)}
            >
              ↓
            </button>
            <button
              type="button"
              className="vc-card-remove"
              aria-label={`Remove ${item.title} from topic`}
              onClick={() => onRemoveBoard(item.id)}
            >
              Remove
            </button>
          </>
        )}
      />
    </section>
  );
}
