import { useId, useRef, useState } from "react";
import type { JSX, KeyboardEvent, PointerEvent } from "react";
import { Trash2, X } from "lucide-react";

import { Toolbar, ToolbarButton } from "../ui/Toolbar";
import {
  STEP_CHIP,
  STEP_CHIP_DRAGGING,
  STEP_CHIP_OFF,
  STEP_CHIP_ON,
  STEP_NUM,
  STEP_REMOVE,
  buttonClass,
  cx,
} from "../ui/styles";

// A pointer needs to move this far before a press becomes a drag rather than a step-selecting click.
const DRAG_THRESHOLD = 4;

const RemoveIcon = <X size={13} aria-hidden="true" />;

type Point = { x: number; y: number };

function centre(el: HTMLElement | undefined): Point {
  if (!el) return { x: NaN, y: NaN };

  const rect = el.getBoundingClientRect();

  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// The row of step chips for a Sequence, grouped in a toolbar with roving arrow-key focus. Read-only in
// playback (click a chip to scrub); in the editor each chip also drags to reorder, the "+ Step" button
// adds one after the current step, and a trailing action removes the current one. Passing the editor
// handlers turns on those affordances. A chip's own remove ✕ is a mouse shortcut on top of that action,
// and a coarse pointer drops it: a fingertip spans both it and the select target beside it, so there the
// trailing action is the only way to remove a step. The active step carries aria-current ("the current
// step"), the correct semantic for a scrubber, so this stays a Toolbar rather than a ToggleGroup; its
// look comes from src/ui styles.
type StepStripProps = {
  steps: readonly { id: string }[];
  current: number;
  onSelect: (index: number) => void;
  onAdd?: () => void;
  onRemove?: (stepId: string) => void;
  /** A mid-gesture reorder frame: a drag streams many, a key press fires one. */
  onMove?: (from: number, to: number) => void;
  /** End the reorder gesture, collapsing its frames to one undo entry. */
  onMoveEnd?: () => void;
};

export function StepStrip({
  steps,
  current,
  onSelect,
  onAdd,
  onRemove,
  onMove,
  onMoveEnd,
}: StepStripProps): JSX.Element {
  const editable = Boolean(onAdd && onRemove);
  const reorderable = Boolean(onMove) && steps.length > 1;
  const hintId = useId();
  const ids = steps.map((s) => s.id);

  // Pointer drag-to-reorder. On the first qualifying move we freeze each chip's slot centre — the slots
  // stay put as chips swap through them, so these stay valid for the whole gesture without re-measuring
  // a layout the live reorder is mutating. The dragged chip lifts, tracks the pointer, and moves to the
  // slot nearest its own centre; moveStep jumps straight there, so a fast drag can cross several slots.
  // Matching by that centre rather than the raw pointer is what keeps the swap where the chip looks, since
  // a grab lands anywhere on the chip — worst on a finger, whose contact point is invisible.
  // Slots are matched in both axes because the strip wraps onto several rows on a narrow screen, where
  // comparing x alone picks a chip on the wrong row. On one row every slot shares a y, so this reduces
  // to the horizontal comparison.
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const chips = useRef(new Map<string, HTMLElement>());
  const drag = useRef<{
    id: string;
    pointerId: number;
    start: Point;
    dragging: boolean;
    slots: Point[];
    index: number;
    grab: Point;
  } | null>(null);
  const suppressClick = useRef(false);

  const onPointerDown = (event: PointerEvent, id: string) => {
    suppressClick.current = false;
    if (event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id,
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      dragging: false,
      slots: [],
      index: 0,
      grab: { x: 0, y: 0 },
    };
  };

  const onPointerMove = (event: PointerEvent) => {
    const d = drag.current;

    if (!d || d.pointerId !== event.pointerId) return;

    if (!d.dragging) {
      if (Math.hypot(event.clientX - d.start.x, event.clientY - d.start.y) < DRAG_THRESHOLD) return;

      d.slots = ids.map((id) => centre(chips.current.get(id)));
      d.index = ids.indexOf(d.id);
      d.grab = { x: d.start.x - d.slots[d.index].x, y: d.start.y - d.slots[d.index].y };
      d.dragging = true;
      setDragId(d.id);
    }

    const held = { x: event.clientX - d.grab.x, y: event.clientY - d.grab.y };
    const reach = (slot: Point) => (held.x - slot.x) ** 2 + (held.y - slot.y) ** 2;

    let target = d.index;

    for (let j = 0; j < d.slots.length; j++) {
      if (reach(d.slots[j]) < reach(d.slots[target])) target = j;
    }

    if (target !== d.index) {
      onMove?.(d.index, target);
      d.index = target;
    }

    setDragOffset({ x: held.x - d.slots[d.index].x, y: held.y - d.slots[d.index].y });
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

    if (d.dragging) {
      suppressClick.current = true;
      onMoveEnd?.();
    }

    drag.current = null;
    setDragId(null);
    setDragOffset({ x: 0, y: 0 });
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
    onMoveEnd?.();
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
              className={cx(STEP_CHIP, i === current ? STEP_CHIP_ON : STEP_CHIP_OFF, dragging && STEP_CHIP_DRAGGING)}
              style={
                dragging ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(1.03)` } : undefined
              }
            >
              <ToolbarButton
                className={cx(
                  STEP_NUM,
                  cursor,
                  reorderable && "touch-none",
                  i === current ? "text-on-accent" : "text-text"
                )}
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
        {editable && steps.length > 1 && steps[current] && (
          <ToolbarButton
            icon={{ variant: "control", size: "md" }}
            aria-label={`Remove current step (${current + 1})`}
            tooltip={`Remove current step (${current + 1})`}
            onClick={() => onRemove?.(steps[current].id)}
          >
            <Trash2 size={14} aria-hidden="true" />
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
