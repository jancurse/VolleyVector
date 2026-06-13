import type { StoredAnnotation } from "../boards/normalize";
import type { StepRotation } from "../boards/types";
import type { NormalizedPoint } from "../court/geometry";
import type { ColorKey, CourtMode, MarkerRole } from "../court/roles";

// The portable bundle format: boards and notes with no server-owned fields (owner, team, sharing,
// tokens, timestamps), carried between apps as plain JSON. Items reference each other through opaque
// local `ref` strings that resolve within the bundle only — import mints fresh ids, export uses the
// real ids as ref values. This module is the single source of truth for the format; the board-creator
// skill's format.md mirrors it.

/** Bump when the format changes shape. Parsing normalizes an older bundle and rejects a newer one.
 *  Version 3 renamed topics to notes: a `notes` array replaces `topics`, a `boards` block's refs are
 *  the note's board links themselves, and a board carries no `topicRef`. */
export const FORMAT_VERSION = 3;

/** One block of a note's document. A `boards` block's refs are the note's board links themselves. */
export type BundleBlock = { kind: "markdown"; text: string } | { kind: "boards"; boardRefs: string[] };

export type BundleNote = {
  ref: string;
  title: string;
  /** Parent note's ref; null or absent for a root. Sibling order is the array order. */
  parentRef?: string | null;
  blocks?: BundleBlock[];
};

/** A marker identity. The `id` is a board-local string, unique within the board, keying `positions`. */
export type BundleMarker = { id: string; role: MarkerRole; label?: string; color?: ColorKey };

export type BundleStep = {
  instruction?: string;
  /** Position per marker id. A marker a step omits is benched (placed just off-court) on import. */
  positions: Record<string, NormalizedPoint>;
  annotations?: StoredAnnotation[];
  /** The step's rotation, carried verbatim from the model (custom-assignment slot keys are strings in JSON). */
  rotation?: StepRotation;
};

export type BundleBoard = {
  ref: string;
  title: string;
  mode: CourtMode;
  markers: BundleMarker[];
  /** Ordered and non-empty: one step is a Position, two or more a Sequence. */
  steps: BundleStep[];
  description?: string;
  tags?: string[];
  autoArrows?: boolean;
  rotationStrict?: boolean;
};

export type Bundle = {
  formatVersion: number;
  notes: BundleNote[];
  boards: BundleBoard[];
};
