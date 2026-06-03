import { useMemo, useState } from "react";
import type { JSX } from "react";

import type { Board } from "../boards/types";
import { collectTags, toLibraryItems } from "./items";
import type { LibraryKind } from "./items";
import { LibraryCard } from "./LibraryCard";

// The library home: every board as a grid of cards, narrowed by a type filter (All / Positions /
// Sequences) and the organising tags. Selecting more tags narrows the grid further (an item must
// carry all of them).
type LibraryProps = {
  boards: readonly Board[];
  onOpen: (id: string) => void;
  onNew: () => void;
};

type TypeFilter = "all" | LibraryKind;

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "position", label: "Positions" },
  { value: "sequence", label: "Sequences" },
];

export function Library({ boards, onOpen, onNew }: LibraryProps): JSX.Element {
  const [type, setType] = useState<TypeFilter>("all");
  const [active, setActive] = useState<string[]>([]);

  const items = useMemo(() => toLibraryItems(boards), [boards]);
  const tags = useMemo(() => collectTags(items), [items]);

  const filtered = items.filter(
    (item) => (type === "all" || item.kind === type) && active.every((tag) => item.tags.includes(tag))
  );

  const toggleTag = (tag: string) =>
    setActive((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

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
          {filtered.map((item) => (
            <LibraryCard key={item.id} item={item} onOpen={() => onOpen(item.id)} />
          ))}
        </div>
      ) : (
        <p className="vc-muted vc-library-empty">
          {items.length === 0 ? "No boards yet." : "Nothing matches these filters."}
        </p>
      )}
    </section>
  );
}
