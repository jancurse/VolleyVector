import { useCallback, useRef, useState } from "react";
import type { JSX, KeyboardEvent } from "react";

import { arrowsForStep } from "../boards/arrows";
import {
  addMarker,
  insertStep,
  moveStep,
  removeMarker,
  removeStep,
  setMarker,
  setStepInstruction,
  setStepPosition,
  stepMarkers,
} from "../boards/operations";
import type { Board } from "../boards/types";
import { isSequence } from "../boards/types";
import { Court } from "../court/Court";
import { clampToCourt } from "../court/geometry";
import type { NormalizedPoint } from "../court/geometry";
import type { CourtMode, MarkerRole } from "../court/roles";
import { TopicPicker } from "../topics/TopicPicker";
import type { Topic } from "../topics/types";
import { Button } from "../ui/Button";
import { CourtFrame } from "../ui/CourtFrame";
import { Input } from "../ui/Input";
import { ToggleGroup } from "../ui/ToggleGroup";
import { DescriptionEditor } from "./DescriptionEditor";
import { MarkerInspector } from "./MarkerInspector";
import { MarkerPalette } from "./MarkerPalette";
import { StepStrip } from "./StepStrip";
import { TagEditor } from "./TagEditor";

const NUDGE = 0.01;
const NUDGE_LARGE = 0.05;
const ARROW_DELTAS: Record<string, NormalizedPoint> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

const MODE_ITEMS = [
  { value: "positions", label: "Positions" },
  { value: "basic", label: "Basic" },
];

// Edits a working draft of one board, one step at a time. A single-step board is a Position — a
// static court, with an Add step affordance that clones the current positions to promote it to a
// Sequence; two or more steps is a Sequence, with the steps strip and a per-step instruction. The
// active step is tracked by id so it survives inserting, reordering, and removing steps. Position
// edits (drag, arrow keys) touch only the active step; identity edits (role, label, colour, add,
// remove) span every step. The court shows the arrows leaving the active step, so the derived
// movement is visible while authoring. Nothing leaves the editor until "Done" commits the draft.
type BoardEditorProps = {
  board: Board;
  onDone: (board: Board) => void;
  onCancel: () => void;
  /** Omitted for a brand-new board that has nothing to delete yet. */
  onDelete?: () => void;
  /** Existing tags across the library, for the tag editor's autocomplete. */
  tagSuggestions?: readonly string[];
  /** The topic tree, for the home-topic picker. */
  topics?: readonly Topic[];
};

export function BoardEditor({
  board,
  onDone,
  onCancel,
  onDelete,
  tagSuggestions,
  topics = [],
}: BoardEditorProps): JSX.Element {
  const [draft, setDraft] = useState(board);
  const [activeStepId, setActiveStepId] = useState(board.steps[0].id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const frameRef = useRef<HTMLElement>(null);

  const stepIndex = Math.max(
    0,
    draft.steps.findIndex((s) => s.id === activeStepId)
  );
  const activeStep = draft.steps[stepIndex] ?? draft.steps[0];
  const markers = stepMarkers(draft, stepIndex);
  const arrows = arrowsForStep(draft, stepIndex);
  const selected = markers.find((m) => m.id === selectedId) ?? null;
  const sequence = isSequence(draft);

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id !== null) frameRef.current?.focus();
  }, []);

  const move = useCallback(
    (id: string, position: NormalizedPoint) => setDraft((d) => setStepPosition(d, activeStepId, id, position)),
    [activeStepId]
  );

  const add = useCallback(
    (role: MarkerRole) => {
      const { board: next, markerId } = addMarker(draft, role, stepIndex);

      setDraft(next);
      setSelectedId(markerId);
      frameRef.current?.focus();
    },
    [draft, stepIndex]
  );

  const appendStep = useCallback(() => {
    const { board: next, stepId } = insertStep(draft, stepIndex);

    setDraft(next);
    setActiveStepId(stepId);
  }, [draft, stepIndex]);

  const deleteStep = useCallback(
    (id: string) => {
      if (id === activeStepId) {
        const idx = draft.steps.findIndex((s) => s.id === id);
        const remaining = draft.steps.filter((s) => s.id !== id);
        const neighbor = remaining[Math.min(idx, remaining.length - 1)];

        if (neighbor) setActiveStepId(neighbor.id);
      }

      setDraft((d) => removeStep(d, id));
    },
    [draft.steps, activeStepId]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const delta = ARROW_DELTAS[event.key];

      if (!selected || !delta) return;

      event.preventDefault();
      const size = event.shiftKey ? NUDGE_LARGE : NUDGE;

      move(
        selected.id,
        clampToCourt({ x: selected.position.x + delta.x * size, y: selected.position.y + delta.y * size })
      );
    },
    [selected, move]
  );

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1320px] flex-col gap-[clamp(0.75rem,2vh,1.25rem)] animate-[rise_0.6s_0.05s_var(--ease-settle)_both] motion-reduce:animate-none">
      <div className="flex items-center gap-4">
        <Button variant="text" onClick={onCancel}>
          Cancel
        </Button>
        <Input
          variant="title"
          value={draft.title}
          placeholder="Untitled board"
          aria-label="Board title"
          onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
        />
        {onDelete && (
          <Button variant="danger" onClick={onDelete}>
            Delete
          </Button>
        )}
        <Button variant="primary" onClick={() => onDone(draft)}>
          Done
        </Button>
      </div>

      <div className="grid grid-cols-[min(74vh,560px)_minmax(0,1fr)] items-stretch gap-[clamp(1rem,3vw,2rem)] max-[1040px]:grid-cols-[minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col items-center gap-[clamp(0.75rem,2vh,1.25rem)]">
          <CourtFrame ref={frameRef} tabIndex={0} aria-label="Court editor" onKeyDown={onKeyDown}>
            <Court
              markers={markers}
              arrows={arrows}
              label={draft.title || "Untitled board"}
              selectedId={selectedId}
              onSelect={select}
              onMove={move}
            />
          </CourtFrame>

          {sequence ? (
            <StepStrip
              steps={draft.steps}
              current={stepIndex}
              onSelect={(i) => setActiveStepId(draft.steps[i]?.id ?? draft.steps[0].id)}
              onAdd={appendStep}
              onRemove={deleteStep}
              onMove={(from, to) => setDraft((d) => moveStep(d, from, to))}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-[0.4rem]">
              <Button variant="dashed" onClick={appendStep} aria-label="Add step">
                + Add step
              </Button>
            </div>
          )}

          <ToggleGroup
            ariaLabel="Court mode"
            items={MODE_ITEMS}
            value={draft.mode}
            onValueChange={(mode) => setDraft((d) => ({ ...d, mode: mode as CourtMode }))}
          />

          <MarkerPalette mode={draft.mode} onAdd={add} />
        </div>

        <aside className="flex min-w-0 flex-col gap-4 max-[1040px]:w-full">
          {selected && (
            <MarkerInspector
              marker={selected}
              mode={draft.mode}
              onChangeRole={(role) => setDraft((d) => setMarker(d, selected.id, { role }))}
              onChangeColor={(color) => setDraft((d) => setMarker(d, selected.id, { color }))}
              onChangeLabel={(label) =>
                setDraft((d) => setMarker(d, selected.id, { label: label.trim() === "" ? undefined : label }))
              }
              onDelete={() => {
                setDraft((d) => removeMarker(d, selected.id));
                setSelectedId(null);
              }}
            />
          )}
          <DescriptionEditor
            value={draft.description}
            onChange={(description) => setDraft((d) => ({ ...d, description }))}
          />
          {sequence && (
            <DescriptionEditor
              key={activeStep.id}
              title={`Step ${stepIndex + 1} instruction`}
              value={activeStep.instruction}
              onChange={(value) => setDraft((d) => setStepInstruction(d, activeStepId, value))}
              placeholder="What happens on this step? (markdown)"
              compact
            />
          )}
          <TagEditor
            tags={draft.tags}
            suggestions={tagSuggestions}
            onChange={(tags) => setDraft((d) => ({ ...d, tags }))}
          />
          <TopicPicker
            topics={topics}
            value={draft.topicId}
            onChange={(topicId) => setDraft((d) => ({ ...d, topicId }))}
            label="Topic"
            noneLabel="Unfiled"
          />
        </aside>
      </div>
    </div>
  );
}
