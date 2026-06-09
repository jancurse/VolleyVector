import type { NormalizedPoint } from "./geometry";
import type { ColorKey, MarkerRole } from "./roles";

// A marker is one object on the court — a player or the ball. Its `id` is a stable identity that
// will persist across a drill's steps (the spine decision that makes playback and derived arrows
// nearly free); for a static tactic there is simply one position per marker.
export type Marker = {
  id: string;
  role: MarkerRole;
  position: NormalizedPoint;
  /** Optional label override; when absent the role's default code is used. */
  label?: string;
  /** Optional colour override (basic mode); when absent the role's colour is used. */
  color?: ColorKey;
};

// A derived movement arrow between two normalized points, coloured to match the marker that moves.
// Drills compute these from step-to-step deltas; the Court only draws them.
export type Arrow = { from: NormalizedPoint; to: NormalizedPoint; color: string };

/** Shared visual style for every annotation: a colour from the marker palette and a stroke width. */
export type AnnotationStyle = { color: ColorKey; width: number };

// An annotation is a shape a coach draws on the court — a line, arrow, rectangle, coverage area, or
// freehand stroke. Unlike a marker it carries no cross-step identity: it belongs to one board step and
// is not interpolated, so a step change crossfades or snaps the layer. A `line`/`rect`/`area` spans two
// corners (`a`/`b`); an `arrow` runs `from`→`to`; `free` is a captured freehand path. `area` is a filled
// ellipse fitted to its bounding box — a coverage zone.
export type Annotation =
  | ({ id: string; kind: "line"; a: NormalizedPoint; b: NormalizedPoint } & AnnotationStyle)
  | ({ id: string; kind: "arrow"; from: NormalizedPoint; to: NormalizedPoint } & AnnotationStyle)
  | ({ id: string; kind: "rect"; a: NormalizedPoint; b: NormalizedPoint } & AnnotationStyle)
  | ({ id: string; kind: "area"; a: NormalizedPoint; b: NormalizedPoint } & AnnotationStyle)
  | ({ id: string; kind: "free"; points: NormalizedPoint[] } & AnnotationStyle);

export type AnnotationKind = Annotation["kind"];

/** The editor's active court tool: move/select markers, select annotations, or draw a shape kind.
 *  `markers` is the default and leaves marker editing exactly as it was. */
export type AnnotationTool = "markers" | "select" | AnnotationKind;
