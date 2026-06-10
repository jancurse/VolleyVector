import { useMemo, useState } from "react";
import type { JSX } from "react";
import { CircleDot, Play } from "lucide-react";

import { ToggleGroup } from "../ui/ToggleGroup";
import { MUTED, cx } from "../ui/styles";
import { CardGrid } from "./CardGrid";
import { collectTags } from "./items";
import type { LibraryItem, LibraryKind } from "./items";
import { TagFilter } from "./TagFilter";

// The All Boards surface's grid: one row of filter pills above a plain CardGrid of the matches. Every
// pill narrows the grid the same way — the two kind pills (mutually exclusive, pressed again to clear;
// nothing pressed means every kind) lead the row, the tag pills and picker follow. The filters live
// here alone, so the topic surfaces — which render through CardGrid directly — carry none. Callers
// decide the card order (newest first for All Boards).
type BoardGridProps = {
  items: readonly LibraryItem[];
  onOpen: (id: string) => void;
  /** When set, the grid leads with a dashed "New board" tile. */
  onNew?: () => void;
  /** Shown when there are no items at all (an empty library). */
  emptyLabel?: string;
};

const KIND_PILLS = [
  {
    value: "position",
    label: (
      <>
        <CircleDot size={13} aria-hidden="true" />
        Positions
      </>
    ),
  },
  {
    value: "sequence",
    label: (
      <>
        <Play size={13} aria-hidden="true" />
        Sequences
      </>
    ),
  },
];

export function BoardGrid({ items, onOpen, onNew, emptyLabel }: BoardGridProps): JSX.Element {
  const [kind, setKind] = useState<LibraryKind | null>(null);
  const [active, setActive] = useState<string[]>([]);

  const tags = useMemo(() => collectTags(items), [items]);
  const filtered = items.filter(
    (item) => (kind === null || item.kind === kind) && active.every((tag) => item.tags.includes(tag))
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-[0.8rem]">
        <ToggleGroup
          multiple
          variant="pills"
          ariaLabel="Filter by kind"
          items={KIND_PILLS}
          value={kind ? [kind] : []}
          onValueChange={(next) => setKind((next.find((v) => v !== kind) as LibraryKind | undefined) ?? null)}
        />
        <TagFilter tags={tags} active={active} onChange={setActive} />
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
