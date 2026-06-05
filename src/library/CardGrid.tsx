import type { JSX } from "react";

import { MUTED, cx } from "../ui/styles";
import type { LibraryItem } from "./items";
import { LibraryCard } from "./LibraryCard";

// The plain grid of board cards, in the order it is given. It carries no filters and no per-card
// controls — just the cards or a plain empty label — so it is shared by the All Boards grid (wrapped
// in BoardGrid's filters) and by a topic page's board groups and trailing grid.
type CardGridProps = {
  items: readonly LibraryItem[];
  onOpen: (id: string) => void;
  /** Shown when there are no items. */
  emptyLabel?: string;
};

export function CardGrid({ items, onOpen, emptyLabel }: CardGridProps): JSX.Element {
  if (items.length === 0) {
    return <p className={cx(MUTED, "px-4 py-12 text-center")}>{emptyLabel ?? "Nothing here yet."}</p>;
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(228px,1fr))] gap-[clamp(0.9rem,2vw,1.4rem)]">
      {items.map((item) => (
        <LibraryCard key={item.id} item={item} onOpen={() => onOpen(item.id)} />
      ))}
    </div>
  );
}
