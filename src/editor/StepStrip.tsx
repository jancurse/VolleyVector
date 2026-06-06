import { useId, useRef, useState } from "react";
import type { JSX, KeyboardEvent, PointerEvent } from "react";

import { Toolbar, ToolbarButton } from "../ui/Toolbar";
import { STEP_CHIP, STEP_CHIP_DRAGGING, STEP_CHIP_ON, STEP_NUM, STEP_REMOVE, buttonClass, cx } from "../ui/styles";

// A pointer needs to move this far before a press becomes a drag rather than a step-selecting click.
const DRAG_THRESHOLD = 4;

const RemoveIcon = (
  <svg viewBox="0 0 16 16" width={13} height={13} fill="none" stroke="currentColor" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" strokeWidth={1.7} strokeLinecap="round" />
  </svg>
);

// The row of step chips for a Sequence, grouped in a toolbar with roving arrow-key focus. Read-only in
// playback (click a chip to scrub); in the editor each chip also drags to reorder and carries a remove
// control, and the "+ Step" button adds one after the current step. Passing the editor handlers turns
// on those affordances. The active step carries aria-current ("the current step"), the correct semantic
// for a scrubber, so this stays a Toolbar rather than a ToggleGroup; its look comes from src/ui styles.
type StepStripProps = {
  steps: readonly { id: string }[];
  current: number;
  onSelect: (index: number) => void;
  onAdd?: () => void;
  onRemove?: (stepId: string) => void;
  onMove?: (from: number, to: number) => void;
};

export function StepStrip({ steps, current, onSelect, onAdd, onRemove, onMove }: StepStripProps): JSX.Element {
  const editable = Boolean(onAdd && onRemove);
  const reorderable = Boolean(onMove) && steps.length > 1;
  const hintId = useId();
  const ids = steps.map((s) => s.id);

  // Pointer drag-to-reorder. On the first qualifying move we freeze each chip's slot centre — the slots
  // stay put as chips swap through them, so these stay valid for the whole gesture without re-measuring
  // a layout the live reorder is mutating. The dragged chip lifts, tracks the pointer, and moves to the
  // slot nearest the pointer; moveStep jumps straight there, so a fast drag can cross several slots.
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragDx, setDragDx] = useState(0);
  const chips = useRef(new Map<string, HTMLElement>());
  const drag = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    dragging: boolean;
    slots: number[];
    index: number;
    grabOffset: number;
  } | null>(null);
  const suppressClick = useRef(false);

  const onPointerDown = (event: PointerEvent, id: string) => {
    suppressClick.current = false;
    if (event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      dragging: false,
      slots: [],
      index: 0,
      grabOffset: 0,
    };
  };

  const onPointerMove = (event: PointerEvent) => {
    const d = drag.current;

    if (!d || d.pointerId !== event.pointerId) return;

    if (!d.dragging) {
      if (Math.abs(event.clientX - d.startX) < DRAG_THRESHOLD) return;

      d.slots = ids.map((id) => {
        const el = chips.current.get(id);

        return el ? el.getBoundingClientRect().left + el.offsetWidth / 2 : NaN;
      });
      d.index = ids.indexOf(d.id);
      d.grabOffset = d.startX - d.slots[d.index];
      d.dragging = true;
      setDragId(d.id);
    }

    let target = d.index;

    for (let j = 0; j < d.slots.length; j++) {
      if (Math.abs(event.clientX - d.slots[j]) < Math.abs(event.clientX - d.slots[target])) target = j;
    }

    if (target !== d.index) {
      onMove?.(d.index, target);
      d.index = target;
    }

    setDragDx(event.clientX - d.grabOffset - d.slots[d.index]);
  };

  const endDrag = (event: PointerEvent) => {
    const d = drag.current;

    if (!d) return;

    if (d.pointerId === event.pointerId) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // The capture may already be released; nothing to do.
      }
    }

    if (d.dragging) suppressClick.current = true;
    drag.current = null;
    setDragId(null);
    setDragDx(0);
  };

  // Swallow the click that follows a drag so a reorder never also scrubs to the chip.
  const selectStep = (index: number) => {
    if (suppressClick.current) {
      suppressClick.current = false;

      return;
    }

    onSelect(index);
  };

  // Shift+Arrow reorders the focused step; Base UI's toolbar leaves modified arrows alone, so plain
  // arrows still roam focus. The focused chip keeps its node across the reorder, so repeats keep working.
  const onNumberKeyDown = (event: KeyboardEvent, index: number) => {
    if (!event.shiftKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;

    const to = event.key === "ArrowLeft" ? index - 1 : index + 1;

    if (to < 0 || to >= steps.length) return;

    event.preventDefault();
    onMove?.(index, to);
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <Toolbar ariaLabel="Steps" className="flex-wrap justify-center gap-1.5">
        {steps.map((step, i) => {
          const dragging = dragId === step.id;
          const cursor = dragging ? "cursor-grabbing" : reorderable ? "cursor-grab" : "cursor-pointer";

          return (
            <div
              key={step.id}
              ref={(el) => {
                if (el) chips.current.set(step.id, el);
                else chips.current.delete(step.id);
              }}
              className={cx(STEP_CHIP, i === current && STEP_CHIP_ON, dragging && STEP_CHIP_DRAGGING)}
              style={dragging ? { transform: `translateX(${dragDx}px) scale(1.03)` } : undefined}
            >
              <ToolbarButton
                className={cx(STEP_NUM, cursor, reorderable && "touch-none", i === current && "text-accent")}
                aria-label={`Step ${i + 1}`}
                aria-current={i === current}
                aria-keyshortcuts={reorderable ? "Shift+ArrowLeft Shift+ArrowRight" : undefined}
                aria-describedby={reorderable ? hintId : undefined}
                onClick={() => selectStep(i)}
                onKeyDown={reorderable ? (event) => onNumberKeyDown(event, i) : undefined}
                onPointerDown={reorderable ? (event) => onPointerDown(event, step.id) : undefined}
                onPointerMove={reorderable ? onPointerMove : undefined}
                onPointerUp={reorderable ? endDrag : undefined}
                onPointerCancel={reorderable ? endDrag : undefined}
              >
                {i + 1}
              </ToolbarButton>
              {editable && steps.length > 1 && (
                <ToolbarButton
                  className={STEP_REMOVE}
                  aria-label={`Remove step ${i + 1}`}
                  tooltip={`Remove step ${i + 1}`}
                  onClick={() => onRemove?.(step.id)}
                >
                  {RemoveIcon}
                </ToolbarButton>
              )}
            </div>
          );
        })}
        {editable && (
          <ToolbarButton
            className={buttonClass("dashed", "md")}
            aria-label="Add step"
            tooltip="Add step"
            onClick={onAdd}
          >
            + Step
          </ToolbarButton>
        )}
      </Toolbar>
      {reorderable && (
        <p id={hintId} className="text-2xs text-text-dim">
          Drag a step to reorder, or focus it and press Shift + ← / →.
        </p>
      )}
    </div>
  );
}
