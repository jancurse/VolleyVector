import type { JSX } from "react";

import type { BoardStep } from "../boards/types";

// The row of step chips for a Sequence. Read-only in playback (click a chip to scrub); in the editor
// it also adds a step after the current one, removes steps, and reorders the current one. Passing the
// editor handlers turns on those affordances.
type StepStripProps = {
  steps: readonly BoardStep[];
  current: number;
  onSelect: (index: number) => void;
  onAdd?: () => void;
  onRemove?: (stepId: string) => void;
  onMove?: (from: number, to: number) => void;
};

export function StepStrip({ steps, current, onSelect, onAdd, onRemove, onMove }: StepStripProps): JSX.Element {
  const editable = Boolean(onAdd && onRemove);

  return (
    <div className="vc-steps" role="group" aria-label="Steps">
      {steps.map((step, i) => (
        <div key={step.id} className={`vc-step-chip${i === current ? " vc-step-chip--on" : ""}`}>
          <button
            type="button"
            className="vc-step-num"
            aria-label={`Step ${i + 1}`}
            aria-current={i === current}
            onClick={() => onSelect(i)}
          >
            {i + 1}
          </button>
          {editable && steps.length > 1 && (
            <button
              type="button"
              className="vc-step-remove"
              aria-label={`Remove step ${i + 1}`}
              onClick={() => onRemove?.(step.id)}
            >
              ×
            </button>
          )}
        </div>
      ))}
      {editable && (
        <button type="button" className="vc-step-add" onClick={onAdd} aria-label="Add step">
          + Step
        </button>
      )}
      {onMove && steps.length > 1 && (
        <div className="vc-step-moves">
          <button
            type="button"
            className="vc-step-move"
            aria-label="Move step earlier"
            disabled={current <= 0}
            onClick={() => onMove(current, current - 1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="vc-step-move"
            aria-label="Move step later"
            disabled={current >= steps.length - 1}
            onClick={() => onMove(current, current + 1)}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
