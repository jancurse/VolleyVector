import { useCallback, useRef, useState } from "react";
import type { JSX, KeyboardEvent } from "react";

import { Court } from "../court/Court";
import { clampToCourt } from "../court/geometry";
import type { NormalizedPoint } from "../court/geometry";
import type { MarkerRole } from "../court/roles";
import { arrowsForStep } from "../drills/arrows";
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
} from "../drills/operations";
import type { Drill } from "../drills/types";
import { DescriptionEditor } from "./DescriptionEditor";
import { MarkerInspector } from "./MarkerInspector";
import { MarkerPalette } from "./MarkerPalette";
import { StepStrip } from "./StepStrip";

const NUDGE = 0.01;
const NUDGE_LARGE = 0.05;
const ARROW_DELTAS: Record<string, NormalizedPoint> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

// Edits a working draft of the drill, one step at a time. The active step is tracked by id so it
// survives inserting, reordering, and removing steps. Position edits (drag, arrow keys) touch only the
// active step; identity edits (role, label, colour, add, remove) span every step. The court shows the
// arrows leaving the active step, so the derived movement is visible while authoring. Nothing leaves
// the editor until "Done" commits the draft.
type DrillEditorProps = {
  drill: Drill;
  onDone: (drill: Drill) => void;
  onCancel: () => void;
  /** Omitted for a brand-new drill that has nothing to delete yet. */
  onDelete?: () => void;
};

export function DrillEditor({ drill, onDone, onCancel, onDelete }: DrillEditorProps): JSX.Element {
  const [draft, setDraft] = useState(drill);
  const [activeStepId, setActiveStepId] = useState(drill.steps[0].id);
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
      const { drill: next, markerId } = addMarker(draft, role, stepIndex);

      setDraft(next);
      setSelectedId(markerId);
      frameRef.current?.focus();
    },
    [draft, stepIndex]
  );

  const appendStep = useCallback(() => {
    const { drill: next, stepId } = insertStep(draft, stepIndex);

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
    <div className="vc-editor">
      <div className="vc-editor-bar">
        <button type="button" className="vc-text-button" onClick={onCancel}>
          Cancel
        </button>
        <input
          className="vc-title-input"
          value={draft.title}
          placeholder="Untitled drill"
          aria-label="Drill title"
          onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
        />
        {onDelete && (
          <button type="button" className="vc-text-button vc-text-button--danger" onClick={onDelete}>
            Delete
          </button>
        )}
        <button type="button" className="vc-primary" onClick={() => onDone(draft)}>
          Done
        </button>
      </div>

      <div className="vc-editor-grid">
        <div className="vc-editor-canvas">
          <figure
            className="vc-court-frame"
            ref={frameRef}
            tabIndex={0}
            aria-label="Court editor"
            onKeyDown={onKeyDown}
          >
            <Court
              markers={markers}
              arrows={arrows}
              label={draft.title || "Untitled drill"}
              selectedId={selectedId}
              onSelect={select}
              onMove={move}
            />
          </figure>

          <StepStrip
            steps={draft.steps}
            current={stepIndex}
            onSelect={(i) => setActiveStepId(draft.steps[i]?.id ?? draft.steps[0].id)}
            onAdd={appendStep}
            onRemove={deleteStep}
            onMove={(from, to) => setDraft((d) => moveStep(d, from, to))}
          />

          <div className="vc-segmented" role="group" aria-label="Court mode">
            {(["positions", "basic"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`vc-seg${draft.mode === m ? " vc-seg--on" : ""}`}
                aria-pressed={draft.mode === m}
                onClick={() => setDraft((d) => ({ ...d, mode: m }))}
              >
                {m === "positions" ? "Positions" : "Basic"}
              </button>
            ))}
          </div>

          <MarkerPalette mode={draft.mode} onAdd={add} />
        </div>

        <aside className="vc-editor-side">
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
            placeholder="Describe the drill in markdown…"
          />
          <DescriptionEditor
            key={activeStep.id}
            title={`Step ${stepIndex + 1} instruction`}
            value={activeStep.instruction}
            onChange={(value) => setDraft((d) => setStepInstruction(d, activeStepId, value))}
            placeholder="What happens on this step? (markdown)"
            compact
          />
        </aside>
      </div>
    </div>
  );
}
