import { useMemo } from "react";
import type { JSX } from "react";

import type { Board } from "../boards/types";
import { BoardGrid } from "./BoardGrid";
import { toLibraryItems } from "./items";

// The All Boards surface: every board as a grid of cards, newest first, narrowed by the type and tag
// filters. The grid and its filters live in BoardGrid, shared with the topic surfaces.
type LibraryProps = {
  boards: readonly Board[];
  onOpen: (id: string) => void;
  onNew: () => void;
};

export function Library({ boards, onOpen, onNew }: LibraryProps): JSX.Element {
  const items = useMemo(() => toLibraryItems(boards), [boards]);

  return (
    <section className="vc-library-page">
      <div className="vc-library-bar">
        <div className="vc-caption">
          <p className="vc-eyebrow">Library</p>
          <h1 className="vc-view-title">Boards</h1>
        </div>
        <div className="vc-new-group">
          <button type="button" className="vc-new" onClick={onNew}>
            + New board
          </button>
        </div>
      </div>

      <BoardGrid items={items} onOpen={onOpen} emptyLabel="No boards yet." />
    </section>
  );
}
