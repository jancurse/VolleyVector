import type { Board } from "../boards/types";
import type { Note } from "../notes/types";

// A structured, client-side diff between two content revisions: the set of fields that changed, by label.
// It is deliberately coarse (which parts moved, not a visual overlay), enough to summarise a revision in the
// history list. Structured values compare by their serialised form, which is exact for the model's plain data.

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The labels of the board fields that differ between two revisions, in a stable reading order. */
export function diffBoard(before: Board, after: Board): string[] {
  const labels: string[] = [];

  if (before.title !== after.title) labels.push("Title");
  if (before.description !== after.description) labels.push("Description");
  if (before.mode !== after.mode) labels.push("Mode");
  if (!same(before.tags, after.tags)) labels.push("Tags");
  if (!same(before.markers, after.markers)) labels.push("Markers");
  if (!same(before.steps, after.steps)) labels.push("Steps");
  if (
    before.autoArrows !== after.autoArrows ||
    before.rotationStrict !== after.rotationStrict ||
    before.opponentSide !== after.opponentSide
  )
    labels.push("Settings");

  return labels;
}

/** The labels of the note fields that differ between two revisions. */
export function diffNote(before: Note, after: Note): string[] {
  const labels: string[] = [];

  if (before.title !== after.title) labels.push("Title");
  if (!same(before.blocks, after.blocks)) labels.push("Content");

  return labels;
}

/** A one-line change summary from a diff's labels. */
export function changeSummary(labels: readonly string[]): string {
  return labels.length === 0 ? "No changes" : labels.join(", ");
}
