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
  /** A short count, e.g. "7 markers" or "3 steps". */
  meta: string;
  updatedAt: number;
};

function count(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Normalize the boards into one list of library cards, most recently edited first. */
export function toLibraryItems(boards: readonly Board[]): LibraryItem[] {
  return boards
    .map((board): LibraryItem => {
      const sequence = isSequence(board);

      return {
        kind: sequence ? "sequence" : "position",
        id: board.id,
        title: board.title || "Untitled board",
        tags: board.tags,
        markers: stepMarkers(board, 0),
        meta: sequence ? count(board.steps.length, "step") : count(board.markers.length, "marker"),
        updatedAt: board.updatedAt,
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Every distinct tag across the items, alphabetically — the set the filter offers. */
export function collectTags(items: readonly LibraryItem[]): string[] {
  return [...new Set(items.flatMap((i) => i.tags))].sort((a, b) => a.localeCompare(b));
}

/** Every distinct tag across all boards, alphabetically — the set the editors autocomplete from. */
export function allTags(boards: readonly Board[]): string[] {
  return [...new Set(boards.flatMap((b) => b.tags))].sort((a, b) => a.localeCompare(b));
}
