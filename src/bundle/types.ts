import type { StoredAnnotation } from "../boards/normalize";
import type { StepRotation } from "../boards/types";
import type { NormalizedPoint } from "../court/geometry";
import type { ColorKey, CourtMode, MarkerRole } from "../court/roles";

// The portable bundle format: boards and topics with no server-owned fields (owner, team, sharing,
// tokens, timestamps), carried between apps as plain JSON. Items reference each other through opaque
// local `ref` strings that resolve within the bundle only — import mints fresh ids, export uses the
// real ids as ref values. This module is the single source of truth for the format; the board-creator
// skill's format.md mirrors it.

/** Bump when the format changes shape. Parsing normalizes an older bundle and rejects a newer one. */
export const FORMAT_VERSION = 2;

/** One block of a topic's document. A `boards` block's refs are placement hints, like `boardIds`. */
export type BundleBlock = { kind: "markdown"; text: string } | { kind: "boards"; boardRefs: string[] };

export type BundleTopic = {
  ref: string;
  title: string;
  /** Parent topic's ref; null or absent for a root. Sibling order is the array order. */
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
  /** Home topic's ref; null or absent for Unfiled. */
  topicRef?: string | null;
  description?: string;
  tags?: string[];
  autoArrows?: boolean;
  rotationStrict?: boolean;
};

export type Bundle = {
  formatVersion: number;
  topics: BundleTopic[];
  boards: BundleBoard[];
};
