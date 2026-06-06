import { useState } from "react";
import type { JSX } from "react";

import { boardsInTopic } from "../boards/operations";
import type { Board } from "../boards/types";
import { TopicEditor } from "../topics/TopicEditor";
import { TopicSidebar } from "../topics/TopicSidebar";
import { TopicView } from "../topics/TopicView";
import type { TopicsStore } from "../topics/useTopics";
import { Library } from "./Library";
import type { Selection } from "./selection";

// The browse surface: a persistent left sidebar (the table of contents) beside a content pane that
// shows All Boards or one topic's page. Editing a topic happens here too, in place, so the sidebar
// stays put. Opening a board leaves this surface entirely (App swaps in the full-width board
// view/editor), so nothing here touches the board view, editor, or playback.
type BrowseProps = {
  boards: readonly Board[];
  topics: TopicsStore;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onOpenBoard: (id: string) => void;
  onNewBoard: () => void;
  onCreateTopic: (parentId: string | null) => void;
  onDeleteTopic: (id: string) => void;
  /** Return one board to Unfiled — the topic editor's per-member unfile action. */
  onUnfileBoard: (boardId: string) => void;
  /** Whether the user may curate this team's library (a coach of it, or an admin). */
  canEdit: boolean;
};

export function Browse({
  boards,
  topics,
  selection,
  onSelect,
  onOpenBoard,
  onNewBoard,
  onCreateTopic,
  onDeleteTopic,
  onUnfileBoard,
  canEdit,
}: BrowseProps): JSX.Element {
  const [editingId, setEditingId] = useState<string | null>(null);

  const select = (next: Selection) => {
    setEditingId(null);
    onSelect(next);
  };

  const selected = selection.kind === "topic" ? topics.topics.find((t) => t.id === selection.id) : undefined;

  let content: JSX.Element;

  if (selected && editingId === selected.id) {
    content = (
      <TopicEditor
        topic={selected}
        boards={boards}
        onCancel={() => setEditingId(null)}
        onDelete={() => onDeleteTopic(selected.id)}
        onUnfileBoard={onUnfileBoard}
        onDone={(patch) => {
          topics.updateTopic(selected.id, { title: patch.title, blocks: patch.blocks });
          setEditingId(null);
        }}
      />
    );
  } else if (selected) {
    content = (
      <TopicView
        topic={selected}
        topics={topics.topics}
        boards={boardsInTopic(boards, selected.id)}
        onOpenBoard={onOpenBoard}
        onSelectTopic={(id) => select({ kind: "topic", id })}
        onEdit={() => setEditingId(selected.id)}
        onAddSubtopic={() => onCreateTopic(selected.id)}
        canEdit={canEdit}
      />
    );
  } else {
    content = <Library boards={boards} onOpen={onOpenBoard} onNew={onNewBoard} canEdit={canEdit} />;
  }

  return (
    <div className="mx-auto grid w-full max-w-[1320px] grid-cols-[minmax(176px,220px)_minmax(0,1fr)] items-start gap-[clamp(1.25rem,3vw,2.5rem)] max-[860px]:grid-cols-[minmax(0,1fr)]">
      <TopicSidebar
        topics={topics.topics}
        selection={selection}
        onSelect={select}
        onNewTopic={() => onCreateTopic(null)}
        onReorder={topics.reorderTopic}
        onNest={topics.reparentTopic}
        canEdit={canEdit}
      />
      <div className="min-w-0">{content}</div>
    </div>
  );
}
