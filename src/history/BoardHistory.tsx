import { useState } from "react";
import type { JSX } from "react";

import type { Board } from "../boards/types";
import { BoardView } from "../editor/BoardView";
import { cx, PAGE_WIDTH } from "../ui/styles";
import { RevisionList } from "./RevisionList";
import { useBoardRevisions } from "./useRevisions";

// A board's history: the revision list beside a read-only preview of the selected revision, rendered through
// the same BoardView every viewer sees. Restore commits a past revision's content as a new revision (handled
// by the caller), so history stays append-only.
type BoardHistoryProps = {
  board: Board;
  onBack: () => void;
  /** Commit a past revision's content as a new revision; absent when the viewer may not edit the board. */
  onRestore?: (snapshot: Board) => void;
};

const LAYOUT = cx(
  "mx-auto grid",
  PAGE_WIDTH,
  "grid-cols-[20rem_minmax(0,1fr)] items-start gap-[clamp(1rem,3vw,2rem)] max-[900px]:grid-cols-[minmax(0,1fr)]"
);

export function BoardHistory({ board, onBack, onRestore }: BoardHistoryProps): JSX.Element {
  const { entries, loading, error } = useBoardRevisions(board);
  const [picked, setPicked] = useState<string | null>(null);

  const selectedId = picked ?? board.currentRevisionId ?? entries[0]?.id ?? null;
  const selected = entries.find((e) => e.id === selectedId);
  const preview = selected?.board ?? board;

  const restore = (id: string) => {
    const entry = entries.find((e) => e.id === id);

    if (entry && onRestore) onRestore(entry.board);
  };

  return (
    <div className={LAYOUT}>
      <RevisionList
        revisions={entries}
        selectedId={selectedId}
        currentId={board.currentRevisionId}
        onSelect={setPicked}
        onRestore={onRestore ? restore : undefined}
        loading={loading}
        error={error}
      />
      <BoardView key={selectedId ?? "current"} board={preview} onBack={onBack} backLabel="← Back to board" />
    </div>
  );
}
