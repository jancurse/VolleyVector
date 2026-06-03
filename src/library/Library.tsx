import { useMemo, useState } from "react";
import type { JSX } from "react";

import type { Drill } from "../drills/types";
import type { Tactic } from "../tactics/types";
import { collectTags, toLibraryItems } from "./items";
import type { LibraryKind } from "./items";
import { LibraryCard } from "./LibraryCard";

// The library home: every tactic and drill as a grid of cards, narrowed by a type filter and the
// organising tags. Selecting more tags narrows the grid further (an item must carry all of them).
type LibraryProps = {
  tactics: readonly Tactic[];
  drills: readonly Drill[];
  onOpen: (kind: LibraryKind, id: string) => void;
  onNewTactic: () => void;
  onNewDrill: () => void;
};

type TypeFilter = "all" | LibraryKind;

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "tactic", label: "Tactics" },
  { value: "drill", label: "Drills" },
];

export function Library({ tactics, drills, onOpen, onNewTactic, onNewDrill }: LibraryProps): JSX.Element {
  const [type, setType] = useState<TypeFilter>("all");
  const [active, setActive] = useState<string[]>([]);

  const items = useMemo(() => toLibraryItems(tactics, drills), [tactics, drills]);
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
          <h1 className="vc-view-title">Tactics &amp; drills</h1>
        </div>
        <div className="vc-new-group">
          <button type="button" className="vc-new" onClick={onNewTactic}>
            + New tactic
          </button>
          <button type="button" className="vc-new" onClick={onNewDrill}>
            + New drill
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
            <LibraryCard key={`${item.kind}-${item.id}`} item={item} onOpen={() => onOpen(item.kind, item.id)} />
          ))}
        </div>
      ) : (
        <p className="vc-muted vc-library-empty">
          {items.length === 0 ? "No tactics or drills yet." : "Nothing matches these filters."}
        </p>
      )}
    </section>
  );
}
