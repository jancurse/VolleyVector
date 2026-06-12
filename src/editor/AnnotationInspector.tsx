import type { JSX } from "react";

import type { AnnotationDash, AnnotationFill, AnnotationStyle } from "../court/types";
import type { ColorKey } from "../court/roles";
import { COLOR_KEYS, MARKER_COLORS } from "../court/roles";
import { Button } from "../ui/Button";
import { SwatchGroup } from "../ui/SwatchGroup";
import { ToggleGroup } from "../ui/ToggleGroup";
import { FIELD_LABEL, PANEL, PANEL_TITLE } from "../ui/styles";
import { ANNOTATION_DASHES, ANNOTATION_FILLS, ANNOTATION_WIDTHS, widthForValue, widthValue } from "./annotationStyle";

// Edits a drawing's style: its colour (from the marker palette), stroke width, and — where they
// apply — a closed shape's fill and a stroked shape's dash. With a shape selected it patches that
// shape and offers a Remove; with only a drawing tool active it sets the style the next shape will
// take. It is the annotation peer of MarkerInspector.
type AnnotationInspectorProps = {
  style: AnnotationStyle;
  /** True when an actual shape is selected (shows the Remove action and a selection title). */
  selected: boolean;
  /** The fill to show, or undefined to hide the control (no closed shape armed or selected). */
  fill?: AnnotationFill;
  /** The dash to show, or undefined to hide the control (no stroked shape armed or selected). */
  dash?: AnnotationDash;
  onChangeColor: (color: ColorKey) => void;
  onChangeWidth: (width: number) => void;
  onChangeFill?: (fill: AnnotationFill) => void;
  onChangeDash?: (dash: AnnotationDash) => void;
  onRemove?: () => void;
};

export function AnnotationInspector({
  style,
  selected,
  fill,
  dash,
  onChangeColor,
  onChangeWidth,
  onChangeFill,
  onChangeDash,
  onRemove,
}: AnnotationInspectorProps): JSX.Element {
  return (
    <section className={PANEL} aria-label="Drawing style">
      <div className="flex items-center justify-between">
        <span className={PANEL_TITLE}>{selected ? "Drawing" : "New drawing"}</span>
        {selected && onRemove && (
          <Button variant="text" size="sm" onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className={FIELD_LABEL}>Colour</span>
        <SwatchGroup
          ariaLabel="Colour"
          value={style.color}
          onValueChange={(key) => onChangeColor(key as ColorKey)}
          items={COLOR_KEYS.map((key) => ({
            value: key,
            label: MARKER_COLORS[key].name,
            fill: MARKER_COLORS[key].fill,
            ring: MARKER_COLORS[key].ring,
          }))}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className={FIELD_LABEL}>Width</span>
        <ToggleGroup
          ariaLabel="Width"
          items={ANNOTATION_WIDTHS.map((w) => ({ value: w.value, label: w.label }))}
          value={widthValue(style.width)}
          onValueChange={(value) => onChangeWidth(widthForValue(value))}
        />
      </div>

      {dash && (
        <div className="flex flex-col gap-2">
          <span className={FIELD_LABEL}>Stroke</span>
          <ToggleGroup
            ariaLabel="Stroke"
            items={ANNOTATION_DASHES.map((d) => ({ value: d.value, label: d.label }))}
            value={dash}
            onValueChange={(value) => onChangeDash?.(value as AnnotationDash)}
          />
        </div>
      )}

      {fill && (
        <div className="flex flex-col gap-2">
          <span className={FIELD_LABEL}>Fill</span>
          <ToggleGroup
            ariaLabel="Fill"
            items={ANNOTATION_FILLS.map((f) => ({ value: f.value, label: f.label }))}
            value={fill}
            onValueChange={(value) => onChangeFill?.(value as AnnotationFill)}
          />
        </div>
      )}
    </section>
  );
}
