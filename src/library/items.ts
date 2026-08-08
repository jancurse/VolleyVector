import { stepMarkers } from "../boards/operations";
import type { Board } from "../boards/types";
import { isSequence } from "../boards/types";
import type { Marker } from "../court/types";

// Folds the boards into one list of cards the library can browse and filter. A card only carries what
// the grid renders — a thumbnail's markers, a tag set, and a count — so the Library stays unaware of a
// board's internals. The thumbnail is the first step; a Position counts its markers, a Sequence its steps.

export type LibraryKind = "position" | "sequence";

export type LibraryItem = {
  kind: LibraryKind;
  id: string;
  title: string;
  tags: string[];
  /** Markers to draw in the card's court thumbnail. */
  markers: Marker[];
  /** Whether the thumbnail draws the opponent half. */
  opponentSide: boolean;
  /** A short count, e.g. "7 markers" or "3 steps". */
  meta: string;
  updatedAt: number;
};

function count(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Fold one board into a library card. */
export function boardToItem(board: Board): LibraryItem {
  const sequence = isSequence(board);

  return {
    kind: sequence ? "sequence" : "position",
    id: board.id,
    title: board.title || "Untitled board",
    tags: board.tags,
    markers: stepMarkers(board, 0),
    opponentSide: board.opponentSide,
    meta: sequence ? count(board.steps.length, "step") : count(board.markers.length, "marker"),
    updatedAt: board.updatedAt,
  };
}

/** Normalize the boards into one list of library cards, most recently edited first. */
export function toLibraryItems(boards: readonly Board[]): LibraryItem[] {
  return boards.map(boardToItem).sort((a, b) => b.updatedAt - a.updatedAt);
}

export type TagCount = { tag: string; count: number };

/** Every distinct tag across the items with its use count, most used first then alphabetical — the
    set the filter offers, in the order the quick pills surface it. */
export function collectTags(items: readonly LibraryItem[]): TagCount[] {
  const counts = new Map<string, number>();

  for (const item of items) for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);

  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Every distinct tag across all boards, alphabetically — the set the editors autocomplete from. */
export function allTags(boards: readonly Board[]): string[] {
  return [...new Set(boards.flatMap((b) => b.tags))].sort((a, b) => a.localeCompare(b));
}
