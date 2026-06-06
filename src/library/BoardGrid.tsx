import { useMemo, useState } from "react";
import type { JSX } from "react";

import { ToggleGroup } from "../ui/ToggleGroup";
import { MUTED, cx } from "../ui/styles";
import { collectTags } from "./items";
import type { LibraryItem, LibraryKind } from "./items";
import { LibraryCard } from "./LibraryCard";

// The filtering grid shared by every browse surface (All Boards and a topic page). It owns the type
// and tag filters and renders the cards in the order it is given — callers decide that order (newest
// first for All Boards, manual order within a topic). A topic page also passes per-card curation
// controls, which render beside each card without nesting inside its button.
type BoardGridProps = {
  items: readonly LibraryItem[];
  onOpen: (id: string) => void;
  /** Shown when there are no items at all (an empty topic, an empty library). */
  emptyLabel?: string;
  /** Optional per-card controls (a topic page's reorder/remove). */
  cardControls?: (item: LibraryItem) => JSX.Element;
};

type TypeFilter = "all" | LibraryKind;

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "position", label: "Positions" },
  { value: "sequence", label: "Sequences" },
];

export function BoardGrid({ items, onOpen, emptyLabel, cardControls }: BoardGridProps): JSX.Element {
  const [type, setType] = useState<TypeFilter>("all");
  const [active, setActive] = useState<string[]>([]);

  const tags = useMemo(() => collectTags(items), [items]);
  const filtered = items.filter(
    (item) => (type === "all" || item.kind === type) && active.every((tag) => item.tags.includes(tag))
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-[0.8rem]">
        <ToggleGroup
          ariaLabel="Filter by type"
          items={TYPE_FILTERS}
          value={type}
          onValueChange={(value) => setType(value as TypeFilter)}
        />
        {tags.length > 0 && (
          <ToggleGroup
            multiple
            variant="pills"
            ariaLabel="Filter by tag"
            items={tags.map((tag) => ({ value: tag, label: tag }))}
            value={active}
            onValueChange={setActive}
          />
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(228px,1fr))] gap-[clamp(0.9rem,2vw,1.4rem)]">
          {filtered.map((item) =>
            cardControls ? (
              <div key={item.id} className="flex flex-col gap-[0.45rem]">
                <LibraryCard item={item} onOpen={() => onOpen(item.id)} />
                <div className="flex items-center gap-[0.3rem]">{cardControls(item)}</div>
              </div>
            ) : (
              <LibraryCard key={item.id} item={item} onOpen={() => onOpen(item.id)} />
            )
          )}
        </div>
      ) : (
        <p className={cx(MUTED, "px-4 py-12 text-center")}>
          {items.length === 0 ? (emptyLabel ?? "Nothing here yet.") : "Nothing matches these filters."}
        </p>
      )}
    </>
  );
}
