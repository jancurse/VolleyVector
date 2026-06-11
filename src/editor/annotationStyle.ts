import type { AnnotationDash, AnnotationFill, NewAnnotationStyle } from "../court/types";

// The annotation drawing palette the toolbar and inspector share: the stroke widths and fill styles
// offered and the default style a fresh board's first shape takes. Widths are SVG-unit stroke weights
// over the court's fixed viewBox, so they read the same at any rendered size (the same space the
// movement arrows use).

export type AnnotationWidth = { value: string; label: string; width: number };

export const ANNOTATION_WIDTHS: readonly AnnotationWidth[] = [
  { value: "thin", label: "Thin", width: 5 },
  { value: "medium", label: "Medium", width: 8 },
  { value: "bold", label: "Bold", width: 14 },
];

export const ANNOTATION_FILLS: readonly { value: AnnotationFill; label: string }[] = [
  { value: "none", label: "None" },
  { value: "tint", label: "Tint" },
  { value: "hachure", label: "Hatch" },
];

export const ANNOTATION_DASHES: readonly { value: AnnotationDash; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
];

export const DEFAULT_ANNOTATION_STYLE: NewAnnotationStyle = { color: "blue", width: 8, fill: "tint", dash: "solid" };

/** The width option matching a stroke weight, falling back to medium for an unrecognised value. */
export function widthValue(width: number): string {
  return (ANNOTATION_WIDTHS.find((w) => w.width === width) ?? ANNOTATION_WIDTHS[1]).value;
}

/** The stroke weight for a width option value, falling back to medium. */
export function widthForValue(value: string): number {
  return (ANNOTATION_WIDTHS.find((w) => w.value === value) ?? ANNOTATION_WIDTHS[1]).width;
}
