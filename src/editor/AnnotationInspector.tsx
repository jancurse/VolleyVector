import type { JSX } from "react";

import type { AnnotationStyle } from "../court/types";
import type { ColorKey } from "../court/roles";
import { COLOR_KEYS, MARKER_COLORS } from "../court/roles";
import { Button } from "../ui/Button";
import { SwatchGroup } from "../ui/SwatchGroup";
import { ToggleGroup } from "../ui/ToggleGroup";
import { FIELD_LABEL, PANEL, PANEL_TITLE, cx } from "../ui/styles";
import { ANNOTATION_WIDTHS, widthForValue, widthValue } from "./annotationStyle";

// Edits a drawing's style: its colour (from the marker palette) and stroke width. With a shape selected
// it patches that shape and offers a Remove; with only a drawing tool active it sets the style the next
// shape will take. It is the annotation peer of MarkerInspector.
type AnnotationInspectorProps = {
  style: AnnotationStyle;
  /** True when an actual shape is selected (shows the Remove action and a selection title). */
  selected: boolean;
  onChangeColor: (color: ColorKey) => void;
  onChangeWidth: (width: number) => void;
  onRemove?: () => void;
};

export function AnnotationInspector({
  style,
  selected,
  onChangeColor,
  onChangeWidth,
  onRemove,
}: AnnotationInspectorProps): JSX.Element {
  return (
    <section
      className={cx(PANEL, "w-[360px] max-w-full self-start max-[1040px]:w-full max-[1040px]:max-w-[440px]")}
      aria-label="Drawing style"
    >
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
    </section>
  );
}
