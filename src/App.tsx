import { useMemo, useState } from "react";
import type { JSX } from "react";

import { createBoard, nextTopicOrder } from "./boards/operations";
import type { Board } from "./boards/types";
import { useBoards } from "./boards/useBoards";
import { BoardEditor } from "./editor/BoardEditor";
import { BoardView } from "./editor/BoardView";
import { Browse } from "./library/Browse";
import { allTags } from "./library/items";
import type { Selection } from "./library/selection";
import { subtreeIds } from "./topics/operations";
import { useTopics } from "./topics/useTopics";
import { useTheme } from "./theme/useTheme";
import { ThemeToggle } from "./ui/ThemeToggle";

// The app moves between three surfaces: the browse surface (the topic sidebar beside the board grid),
// a read-only view of one board, and the editor for a working draft. A draft takes precedence over
// everything; otherwise an open board shows its view; otherwise the browse surface. The sidebar
// belongs to the browse surface only — the board view and editor stay full-width.

export function App(): JSX.Element {
  const [theme, toggleTheme] = useTheme();

  const { boards, addBoard, deleteBoard, updateBoard, moveBoardInTopic, unfileBoards } = useBoards();
  const topics = useTopics();

  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Board | null>(null);
  const [selection, setSelection] = useState<Selection>({ kind: "all" });

  const openBoard = openId !== null ? (boards.find((b) => b.id === openId) ?? null) : null;

  const commit = (updated: Board) => {
    // Filing a board into a different topic appends it after that topic's boards.
    const prev = boards.find((b) => b.id === updated.id);
    const refiled = (prev?.topicId ?? null) !== updated.topicId;
    const final = refiled ? { ...updated, topicOrder: nextTopicOrder(boards, updated.topicId) } : updated;

    if (prev) updateBoard(updated.id, () => final);
    else addBoard(final);

    setDraft(null);
    setOpenId(updated.id);
  };

  const remove = (id: string) => {
    if (!window.confirm("Delete this board? This cannot be undone.")) return;

    deleteBoard(id);
    setDraft(null);
    setOpenId(null);
  };

  const createTopic = (parentId: string | null) => setSelection({ kind: "topic", id: topics.addTopic(parentId) });

  const removeTopic = (id: string) => {
    if (!window.confirm("Delete this topic and its subtopics? Its boards return to Unfiled.")) return;

    const removed = subtreeIds(topics.topics, id);

    unfileBoards(boards.filter((b) => b.topicId !== null && removed.includes(b.topicId)).map((b) => b.id));
    topics.removeTopic(id);
    if (selection.kind === "topic" && removed.includes(selection.id)) setSelection({ kind: "all" });
  };

  const draftExisting = draft !== null && boards.some((b) => b.id === draft.id);
  const tagSuggestions = useMemo(() => allTags(boards), [boards]);

  let main: JSX.Element;

  if (draft) {
    main = (
      <main className="vc-stage">
        <BoardEditor
          key={draft.id}
          board={draft}
          onDone={commit}
          onCancel={() => setDraft(null)}
          onDelete={draftExisting ? () => remove(draft.id) : undefined}
          tagSuggestions={tagSuggestions}
          topics={topics.topics}
        />
      </main>
    );
  } else if (openBoard) {
    main = (
      <main className="vc-stage">
        <BoardView board={openBoard} onEdit={() => setDraft(openBoard)} onBack={() => setOpenId(null)} />
      </main>
    );
  } else {
    main = (
      <main className="vc-home">
        <Browse
          boards={boards}
          topics={topics}
          selection={selection}
          onSelect={setSelection}
          onOpenBoard={setOpenId}
          onNewBoard={() => setDraft(createBoard(Date.now()))}
          onCreateTopic={createTopic}
          onDeleteTopic={removeTopic}
          onMoveBoardInTopic={moveBoardInTopic}
          onRemoveBoardFromTopic={(boardId) => unfileBoards([boardId])}
        />
      </main>
    );
  }

  return (
    <div className="vc-app">
      <header className="vc-header">
        <div className="vc-brand">
          <svg className="vc-logo" viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="12" cy="15" r="2.1" fill="currentColor" />
          </svg>
          <span>VolleyCoach</span>
        </div>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </header>

      {main}
    </div>
  );
}
