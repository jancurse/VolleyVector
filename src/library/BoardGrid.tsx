import { useMemo, useState } from "react";
import type { JSX } from "react";

import { ToggleGroup } from "../ui/ToggleGroup";
import { MUTED, cx } from "../ui/styles";
import { CardGrid } from "./CardGrid";
import { collectTags } from "./items";
import type { LibraryItem, LibraryKind } from "./items";

// The All Boards surface's grid: the type and tag filters above a plain CardGrid of the matches. The
// filters live here alone, so the topic surfaces — which render through CardGrid directly — carry
// none. Callers decide the card order (newest first for All Boards).
type BoardGridProps = {
  items: readonly LibraryItem[];
  onOpen: (id: string) => void;
  /** When set, the grid leads with a dashed "New board" tile. */
  onNew?: () => void;
  /** Shown when there are no items at all (an empty library). */
  emptyLabel?: string;
};

type TypeFilter = "all" | LibraryKind;

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "position", label: "Positions" },
  { value: "sequence", label: "Sequences" },
];

export function BoardGrid({ items, onOpen, onNew, emptyLabel }: BoardGridProps): JSX.Element {
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

      {filtered.length > 0 || (items.length === 0 && onNew) ? (
        <CardGrid items={filtered} onOpen={onOpen} onNew={onNew} />
      ) : (
        <p className={cx(MUTED, "px-4 py-12 text-center")}>
          {items.length === 0 ? (emptyLabel ?? "Nothing here yet.") : "Nothing matches these filters."}
        </p>
      )}
    </>
  );
}
