import type { JSX } from "react";

import { MUTED, cx } from "../ui/styles";
import { AddBoardCard } from "./AddBoardCard";
import type { LibraryItem } from "./items";
import { LibraryCard } from "./LibraryCard";

// The plain grid of board cards, in the order it is given. It carries no filters and no per-card
// controls — just the cards or a plain empty label — so it is shared by the All Boards grid (wrapped
// in BoardGrid's filters) and by a note page's board groups and trailing grid. Passing `onNew`
// prepends a dashed add tile, so creation lives where the new card will appear.
type CardGridProps = {
  items: readonly LibraryItem[];
  onOpen: (id: string) => void;
  /** When set, the grid leads with a dashed "New board" tile. */
  onNew?: () => void;
  /** Shown when there are no items. */
  emptyLabel?: string;
};

export function CardGrid({ items, onOpen, onNew, emptyLabel }: CardGridProps): JSX.Element {
  if (items.length === 0 && !onNew) {
    return <p className={cx(MUTED, "px-4 py-12 text-center")}>{emptyLabel ?? "Nothing here yet."}</p>;
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(228px,1fr))] gap-[clamp(0.9rem,2vw,1.4rem)]">
      {onNew && <AddBoardCard onNew={onNew} />}
      {items.map((item) => (
        <LibraryCard key={item.id} item={item} onOpen={() => onOpen(item.id)} />
      ))}
    </div>
  );
}
