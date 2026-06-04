import { useMemo, useState } from "react";
import type { JSX } from "react";

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

  const toggleTag = (tag: string) =>
    setActive((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  return (
    <>
      <div className="vc-filters">
        <div className="vc-segmented" role="group" aria-label="Filter by type">
          {TYPE_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`vc-seg${type === option.value ? " vc-seg--on" : ""}`}
              aria-pressed={type === option.value}
              onClick={() => setType(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {tags.length > 0 && (
          <div className="vc-tag-filter" role="group" aria-label="Filter by tag">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`vc-tag-toggle${active.includes(tag) ? " vc-tag-toggle--on" : ""}`}
                aria-pressed={active.includes(tag)}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="vc-grid">
          {filtered.map((item) =>
            cardControls ? (
              <div key={item.id} className="vc-card-wrap">
                <LibraryCard item={item} onOpen={() => onOpen(item.id)} />
                <div className="vc-card-controls">{cardControls(item)}</div>
              </div>
            ) : (
              <LibraryCard key={item.id} item={item} onOpen={() => onOpen(item.id)} />
            )
          )}
        </div>
      ) : (
        <p className="vc-muted vc-library-empty">
          {items.length === 0 ? (emptyLabel ?? "Nothing here yet.") : "Nothing matches these filters."}
        </p>
      )}
    </>
  );
}
