import { useMemo, useState } from "react";
import type { JSX } from "react";

import { createBoard } from "./boards/operations";
import type { Board } from "./boards/types";
import { useBoards } from "./boards/useBoards";
import { BoardEditor } from "./editor/BoardEditor";
import { BoardView } from "./editor/BoardView";
import { Library } from "./library/Library";
import { allTags } from "./library/items";
import { useTheme } from "./theme/useTheme";
import { ThemeToggle } from "./ui/ThemeToggle";

// The app moves between three surfaces: the library grid (home), a read-only view of one board, and
// the editor for a working draft. A draft takes precedence over everything; otherwise an open board
// shows its view; otherwise the library. Committing or deleting a draft returns to the right surface.

export function App(): JSX.Element {
  const [theme, toggleTheme] = useTheme();

  const { boards, addBoard, deleteBoard, updateBoard } = useBoards();

  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Board | null>(null);

  const openBoard = openId !== null ? (boards.find((b) => b.id === openId) ?? null) : null;

  const commit = (updated: Board) => {
    if (boards.some((b) => b.id === updated.id)) updateBoard(updated.id, () => updated);
    else addBoard(updated);

    setDraft(null);
    setOpenId(updated.id);
  };

  const remove = (id: string) => {
    if (!window.confirm("Delete this board? This cannot be undone.")) return;

    deleteBoard(id);
    setDraft(null);
    setOpenId(null);
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
        <Library boards={boards} onOpen={setOpenId} onNew={() => setDraft(createBoard(Date.now()))} />
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
