import { useMemo } from "react";
import type { JSX, ReactNode } from "react";

import type { Board } from "../boards/types";
import { EYEBROW, PAGE, PAGE_BAR, TITLE } from "../ui/styles";
import { BoardGrid } from "./BoardGrid";
import { toLibraryItems } from "./items";

// The All Boards surface: every board as a grid of cards, newest first, narrowed by the type and tag
// filters. The grid and its filters live in BoardGrid, shared with the note surfaces.
type LibraryProps = {
  boards: readonly Board[];
  onOpen: (id: string) => void;
  onNew: () => void;
  /** Whether to offer the New board action (a coach of this team, or an admin). */
  canEdit: boolean;
  /** The page-bar overflow menu (the space's JSON export and import). */
  menu?: ReactNode;
};

export function Library({ boards, onOpen, onNew, canEdit, menu }: LibraryProps): JSX.Element {
  const items = useMemo(() => toLibraryItems(boards), [boards]);

  return (
    <section className={PAGE}>
      <div className={PAGE_BAR}>
        <div>
          <p className={EYEBROW}>Library</p>
          <h1 className={TITLE}>Boards</h1>
        </div>
        {menu}
      </div>

      <BoardGrid items={items} onOpen={onOpen} onNew={canEdit ? onNew : undefined} emptyLabel="No boards yet." />
    </section>
  );
}
