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

/** A closed shape's fill treatment: outline only, a translucent tint, or hand-drawn hatching. */
export type AnnotationFill = "none" | "tint" | "hachure";

/** A stroked shape's dash treatment; absent means solid. */
export type AnnotationDash = "solid" | "dashed";

/** The shared style plus the dash a stroked shape (line, arrow, rect, ellipse, polygon) carries. */
type StrokedStyle = AnnotationStyle & { dash?: AnnotationDash };

/** The style the editor's next drawn shape takes: the shared style plus the sticky fill and dash. */
export type NewAnnotationStyle = AnnotationStyle & { fill: AnnotationFill; dash: AnnotationDash };

// An annotation is a shape a coach draws on the court — a line, arrow, rectangle, ellipse, polygon,
// freehand stroke, or text label. Unlike a marker it carries no cross-step identity: it belongs to one
// board step and is not interpolated, so a step change crossfades or snaps the layer. A
// `line`/`rect`/`ellipse` spans two corners (`a`/`b`); an `arrow` runs `from`→`to`, bent into a
// quadratic through `via` when present (absent means straight); a `polygon` is an implicitly closed
// run of 3+ vertices; `free` is a captured freehand path; `text` is a label centred on `at` (its
// `width` maps to a font size). The closed shapes (rect, ellipse, polygon) carry a fill.
export type Annotation =
  | ({ id: string; kind: "line"; a: NormalizedPoint; b: NormalizedPoint } & StrokedStyle)
  | ({ id: string; kind: "arrow"; from: NormalizedPoint; to: NormalizedPoint; via?: NormalizedPoint } & StrokedStyle)
  | ({ id: string; kind: "rect"; a: NormalizedPoint; b: NormalizedPoint; fill: AnnotationFill } & StrokedStyle)
  | ({ id: string; kind: "ellipse"; a: NormalizedPoint; b: NormalizedPoint; fill: AnnotationFill } & StrokedStyle)
  | ({ id: string; kind: "polygon"; points: NormalizedPoint[]; fill: AnnotationFill } & StrokedStyle)
  | ({ id: string; kind: "free"; points: NormalizedPoint[] } & AnnotationStyle)
  | ({ id: string; kind: "text"; at: NormalizedPoint; text: string } & AnnotationStyle);

export type AnnotationKind = Annotation["kind"];

/** The closed shapes — the annotations that carry a fill. */
export type ClosedAnnotation = Extract<Annotation, { fill: AnnotationFill }>;

const CLOSED_KINDS: ReadonlySet<string> = new Set(["rect", "ellipse", "polygon"]);

/** True for a closed shape (rect, ellipse, polygon), narrowing to the fill-carrying variants. */
export function hasFill(annotation: Annotation): annotation is ClosedAnnotation {
  return CLOSED_KINDS.has(annotation.kind);
}

/** The stroked shapes — the annotations that may dash their stroke. */
export type StrokedAnnotation = Exclude<Annotation, { kind: "free" | "text" }>;

const STROKED_KINDS: ReadonlySet<string> = new Set(["line", "arrow", "rect", "ellipse", "polygon"]);

/** True for a stroked shape (not freehand or text), narrowing to the dash-carrying variants. */
export function hasDash(annotation: Annotation): annotation is StrokedAnnotation {
  return STROKED_KINDS.has(annotation.kind);
}

/** The editor's active court tool: move/select markers, select annotations, or draw a shape kind.
 *  `markers` is the default and leaves marker editing exactly as it was. */
export type AnnotationTool = "markers" | "select" | AnnotationKind;

/** True when `tool` draws a closed shape, so the fill style applies to what it draws next. */
export function isFillTool(tool: AnnotationTool): boolean {
  return CLOSED_KINDS.has(tool);
}

/** True when `tool` draws a stroked shape, so the dash style applies to what it draws next. */
export function isDashTool(tool: AnnotationTool): boolean {
  return STROKED_KINDS.has(tool);
}
