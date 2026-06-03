import type { Marker } from "../court/types";
import { stepMarkers } from "../drills/operations";
import type { Drill } from "../drills/types";
import type { Tactic } from "../tactics/types";

// Folds tactics and drills into one list of cards the library can browse and filter. A card only
// carries what the grid renders — a thumbnail's markers, a tag set, and a count — so the Library
// stays unaware of each content type's internals. A drill's thumbnail is its first step.

export type LibraryKind = "tactic" | "drill";

export type LibraryItem = {
  kind: LibraryKind;
  id: string;
  title: string;
  tags: string[];
  /** Markers to draw in the card's court thumbnail. */
  markers: Marker[];
  /** A short count, e.g. "7 markers" or "3 steps". */
  meta: string;
  updatedAt: number;
};

function count(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Normalize tactics and drills into one list of library cards, most recently edited first. */
export function toLibraryItems(tactics: readonly Tactic[], drills: readonly Drill[]): LibraryItem[] {
  const items: LibraryItem[] = [
    ...tactics.map((t) => ({
      kind: "tactic" as const,
      id: t.id,
      title: t.title || "Untitled tactic",
      tags: t.tags,
      markers: t.markers,
      meta: count(t.markers.length, "marker"),
      updatedAt: t.updatedAt,
    })),
    ...drills.map((d) => ({
      kind: "drill" as const,
      id: d.id,
      title: d.title || "Untitled drill",
      tags: d.tags,
      markers: stepMarkers(d, 0),
      meta: count(d.steps.length, "step"),
      updatedAt: d.updatedAt,
    })),
  ];

  return items.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Every distinct tag across the items, alphabetically — the set the filter offers. */
export function collectTags(items: readonly LibraryItem[]): string[] {
  return [...new Set(items.flatMap((i) => i.tags))].sort((a, b) => a.localeCompare(b));
}

/** Every distinct tag across both collections, alphabetically — the set the editors autocomplete from. */
export function allTags(tactics: readonly Tactic[], drills: readonly Drill[]): string[] {
  const tags = [...tactics.flatMap((t) => t.tags), ...drills.flatMap((d) => d.tags)];

  return [...new Set(tags)].sort((a, b) => a.localeCompare(b));
}
