import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX, KeyboardEvent } from "react";
import { Redo2, Undo2 } from "lucide-react";

import { arrowsForStep } from "../boards/arrows";
import {
  addAnnotation,
  addMarker,
  copyAnnotationsToNextStep,
  duplicateAnnotation,
  insertStep,
  moveStep,
  removeAnnotation,
  removeMarker,
  removeStep,
  reshapeAnnotation,
  setMarker,
  setStepInstruction,
  setStepPosition,
  stepAnnotations,
  stepMarkers,
  translateAnnotation,
  updateAnnotation,
} from "../boards/operations";
import type { AnnotationHandle } from "../boards/operations";
import {
  clampToLegal,
  isFrontRow,
  placeRotationMarker,
  rotationAssignment,
  rotationViolations,
  setStepRotation,
  violationFlags,
} from "../boards/rotation";
import type { Annotation, Board, RotationSlot, StepRotation } from "../boards/types";
import { isSequence } from "../boards/types";
import { Court } from "../court/Court";
import { clampToCourt, snapToGrid, toSvg, VIEW_SIZE } from "../court/geometry";
import { snapAnnotationPoint } from "../court/snapping";
import type { NormalizedPoint } from "../court/geometry";
import type { AnnotationTool, NewAnnotationStyle } from "../court/types";
import { hasDash, hasFill, isDashTool, isFillTool } from "../court/types";
import type { MarkerRole } from "../court/roles";
import { Button } from "../ui/Button";
import { Combobox } from "../ui/Combobox";
import { CourtFrame } from "../ui/CourtFrame";
import { IconButton } from "../ui/IconButton";
import { Input } from "../ui/Input";
import { AnnotationInspector } from "./AnnotationInspector";
import { AnnotationToolbar } from "./AnnotationToolbar";
import { DEFAULT_ANNOTATION_STYLE } from "./annotationStyle";
import { CourtSettings } from "./CourtSettings";
import { DescriptionEditor } from "./DescriptionEditor";
import { saveDraftBackup } from "./draftBackup";
import { MarkerInspector } from "./MarkerInspector";
import { MarkerPalette } from "./MarkerPalette";
import { RotationPanel } from "./RotationPanel";
import { StepStrip } from "./StepStrip";
import { useDraftHistory } from "./useDraftHistory";
import { useEditorShortcuts } from "./useEditorShortcuts";
import { useWideEditor } from "./useWideEditor";

const NUDGE = 0.01;
const NUDGE_LARGE = 0.05;

// The inline editor for a placed text label, floated over the court at the label's position.
const TEXT_OVERLAY =
  "absolute z-10 w-36 -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-bg px-2 py-1 text-center text-sm text-text shadow-sm focus:outline-2 focus:outline-accent-weak";

/** A normalized court coordinate as a CSS percentage of the (square) court frame. */
function framePercent(normalized: number): string {
  return `${(toSvg(normalized) / VIEW_SIZE) * 100}%`;
}
const ARROW_DELTAS: Record<string, NormalizedPoint> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

// Edits a working draft of one board, one step at a time. A single-step board is a Position — a
// static court, with an Add step affordance that clones the current positions to promote it to a
// Sequence; two or more steps is a Sequence, with the steps strip and a per-step instruction. The
// active step is tracked by id so it survives inserting, reordering, and removing steps. Position
// edits (drag, arrow keys) touch only the active step; identity edits (role, label, colour, add,
// remove) span every step. The court shows the arrows leaving the active step, so the derived
// movement is visible while authoring. Nothing leaves the editor until "Done" commits the draft.
type BoardEditorProps = {
  board: Board;
  /** Commit the draft. Resolves to null on success (the editor then navigates away), or to an error
   *  message — the editor stays open with the draft intact and Done retries. */
  onDone: (board: Board) => Promise<string | null>;
  onCancel: () => void;
  /** Existing tags across the library, for the tag editor's autocomplete. */
  tagSuggestions?: readonly string[];
  /** Label for the commit button; the draft preview relabels it "Save & copy JSON". */
  doneLabel?: string;
};

export function BoardEditor({
  board,
  onDone,
  onCancel,
  tagSuggestions,
  doneLabel = "Done",
}: BoardEditorProps): JSX.Element {
  const { draft, activeStepId, setActiveStepId, set, replace, commit, undo, redo, canUndo, canRedo } =
    useDraftHistory(board);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<AnnotationTool>("markers");
  const [annotationStyle, setAnnotationStyle] = useState<NewAnnotationStyle>(DEFAULT_ANNOTATION_STYLE);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [grid, setGrid] = useState(0);
  const [snapOn, setSnapOn] = useState(true);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const frameRef = useRef<HTMLElement>(null);
  // Set while Escape is cancelling the text editor, so the following blur undoes instead of keeping.
  const textCancelled = useRef(false);
  const wide = useWideEditor();

  const snap = useMemo(
    () => (grid > 0 && snapOn ? (p: NormalizedPoint) => snapToGrid(p, grid) : undefined),
    [grid, snapOn]
  );

  const stepIndex = Math.max(
    0,
    draft.steps.findIndex((s) => s.id === activeStepId)
  );
  const activeStep = draft.steps[stepIndex] ?? draft.steps[0];
  const markers = stepMarkers(draft, stepIndex);
  const annotations = stepAnnotations(draft, stepIndex);
  const arrows = draft.autoArrows ? arrowsForStep(draft, stepIndex) : [];
  const selected = markers.find((m) => m.id === selectedId) ?? null;
  const selectedAnnotation = annotations.find((a) => a.id === selectedAnnotationId) ?? null;
  const editingText = annotations.find((a) => a.id === editingTextId && a.kind === "text") ?? null;
  const sequence = isSequence(draft);

  // The active step's rotation, resolved: a complete assignment drives the overlap checks (in both
  // enforcement flavours) and the court's violation flags; an inactive rotation drives neither.
  const assignment = useMemo(
    () => rotationAssignment(draft.markers, activeStep.rotation),
    [draft.markers, activeStep.rotation]
  );
  const violations = useMemo(
    () => (assignment ? rotationViolations(assignment, activeStep.positions, draft.markers) : []),
    [assignment, activeStep.positions, draft.markers]
  );
  const warnings = assignment && violations.length > 0 ? violationFlags(assignment, violations) : undefined;

  // Drawn/reshaped points snap to the court's features and the active step's markers; the grid joins
  // in only while grid snapping is on. Alt bypasses inside the draw hook.
  const annotationSnap = useMemo(() => {
    const points = stepMarkers(draft, stepIndex).map((m) => m.position);
    const divisions = grid > 0 && snapOn ? grid : 0;

    return (p: NormalizedPoint) => snapAnnotationPoint(p, points, divisions);
  }, [draft, stepIndex, grid, snapOn]);

  // Back the working draft up to localStorage on every change, so a reload mid-edit loses nothing.
  // The untouched initial draft writes no backup, so merely opening the editor never prompts a restore.
  useEffect(() => {
    if (draft !== board) saveDraftBackup(draft);
  }, [draft, board]);

  // Done commits the draft. While the save is in flight the editor stays open and Done cannot be
  // pressed again; on failure the draft stays fully intact and Done retries.
  const done = async () => {
    setSaving(true);
    setSaveError(null);

    const error = await onDone(draft);

    setSaving(false);
    if (error !== null) setSaveError(error);
  };

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id !== null) frameRef.current?.focus();
  }, []);

  // Switching tool clears both selections, so a leftover marker or shape selection never lingers under
  // a different tool's inspector.
  const changeTool = useCallback((next: AnnotationTool) => {
    setTool(next);
    setSelectedId(null);
    setSelectedAnnotationId(null);
  }, []);

  // In strict mode a drag on the actual board clamps at the legal boundary, relative to the other
  // assigned players' positions on the fresh draft; unassigned markers move freely.
  const move = useCallback(
    (id: string, position: NormalizedPoint) =>
      replace((d) => {
        const step = d.steps.find((s) => s.id === activeStepId);
        const legal = d.rotationStrict && step ? rotationAssignment(d.markers, step.rotation) : null;
        const target = legal && step ? clampToLegal(legal, step.positions, id, position) : position;

        return setStepPosition(d, activeStepId, id, target);
      }),
    [replace, activeStepId]
  );

  const changeRotation = useCallback(
    (rotation: StepRotation | undefined) => set((d) => setStepRotation(d, activeStepId, rotation)),
    [set, activeStepId]
  );

  // Placing on the custom rotation board; strict mode refuses a libero on a front-row position.
  const place = useCallback(
    (markerId: string, slot: RotationSlot | null) =>
      set((d) => {
        const libero = d.markers.find((m) => m.id === markerId)?.role === "libero";

        if (d.rotationStrict && libero && slot !== null && isFrontRow(slot)) return d;

        return placeRotationMarker(d, activeStepId, markerId, slot);
      }),
    [set, activeStepId]
  );

  // Sticky tools: the drawing tool stays active after each shape (Esc returns to select), so a coach
  // can lay down several shapes in a row without re-picking the tool. A placed text label opens its
  // inline editor immediately.
  const drawAnnotation = useCallback(
    (annotation: Annotation) => {
      set((d) => addAnnotation(d, activeStepId, annotation));
      if (annotation.kind === "text") setEditingTextId(annotation.id);
    },
    [set, activeStepId]
  );

  // Closing the text editor: Escape (or ending up empty) undoes the whole placement — the label's
  // creation was the last recorded edit, so one undo removes it without a junk history entry.
  const finishTextEdit = useCallback(
    (text: string) => {
      if (textCancelled.current || text.trim() === "") undo();

      textCancelled.current = false;
      setEditingTextId(null);
    },
    [undo]
  );

  const reshape = useCallback(
    (id: string, handle: AnnotationHandle, point: NormalizedPoint) =>
      replace((d) => {
        const annotation = (d.steps.find((s) => s.id === activeStepId)?.annotations ?? []).find((a) => a.id === id);

        return annotation ? updateAnnotation(d, activeStepId, id, reshapeAnnotation(annotation, handle, point)) : d;
      }),
    [replace, activeStepId]
  );

  const translate = useCallback(
    (id: string, dx: number, dy: number) =>
      replace((d) => {
        const annotation = (d.steps.find((s) => s.id === activeStepId)?.annotations ?? []).find((a) => a.id === id);

        return annotation ? updateAnnotation(d, activeStepId, id, translateAnnotation(annotation, dx, dy)) : d;
      }),
    [replace, activeStepId]
  );

  const styleAnnotation = useCallback(
    (patch: Partial<NewAnnotationStyle>) => {
      setAnnotationStyle((s) => ({ ...s, ...patch }));
      if (selectedAnnotationId) set((d) => updateAnnotation(d, activeStepId, selectedAnnotationId, patch));
    },
    [set, activeStepId, selectedAnnotationId]
  );

  const add = useCallback(
    (role: MarkerRole) => {
      const { board: next, markerId } = addMarker(draft, role, stepIndex);

      set(() => next);
      changeTool("markers");
      setSelectedId(markerId);
      frameRef.current?.focus();
    },
    [draft, stepIndex, set, changeTool]
  );

  const appendStep = useCallback(() => {
    const { board: next, stepId } = insertStep(draft, stepIndex);

    set(() => next);
    setActiveStepId(stepId);
  }, [draft, stepIndex, set, setActiveStepId]);

  const deleteStep = useCallback(
    (id: string) => {
      const idx = draft.steps.findIndex((s) => s.id === id);
      const remaining = draft.steps.filter((s) => s.id !== id);
      const neighbor = remaining[Math.min(idx, remaining.length - 1)];

      // Record the removal first, so the undo snapshot still carries the deleted step as active.
      set((d) => removeStep(d, id));
      if (id === activeStepId && neighbor) setActiveStepId(neighbor.id);
    },
    [draft.steps, activeStepId, set, setActiveStepId]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const delta = ARROW_DELTAS[event.key];

      if (!delta) return;

      const size = event.shiftKey ? NUDGE_LARGE : NUDGE;

      if (selectedAnnotationId) {
        event.preventDefault();
        translate(selectedAnnotationId, delta.x * size, delta.y * size);
      } else if (selected) {
        event.preventDefault();
        move(
          selected.id,
          clampToCourt({ x: selected.position.x + delta.x * size, y: selected.position.y + delta.y * size })
        );
      }
    },
    [selected, selectedAnnotationId, move, translate]
  );

  useEditorShortcuts({
    onUndo: undo,
    onRedo: redo,
    // The draw hook consumes Escape (preventDefault) while a shape is mid-draw, so this only ever
    // sees the next press: clear any selection first, then step a drawing tool back to select.
    onEscape: () => {
      if (selectedId || selectedAnnotationId) {
        setSelectedId(null);
        setSelectedAnnotationId(null);
      } else if (tool !== "markers" && tool !== "select") {
        setTool("select");
      }
    },
    onDelete: () => {
      if (selectedAnnotation) {
        set((d) => removeAnnotation(d, activeStepId, selectedAnnotation.id));
        setSelectedAnnotationId(null);
      } else if (selected) {
        set((d) => removeMarker(d, selected.id));
        setSelectedId(null);
      }
    },
    onDuplicate: () => {
      if (!selectedAnnotation) return;

      const copy = duplicateAnnotation(selectedAnnotation);

      set((d) => addAnnotation(d, activeStepId, copy));
      setSelectedAnnotationId(copy.id);
    },
    onTool: changeTool,
  });

  // The gear lives in whichever tool rail is on screen: opening rightward off the wide vertical
  // rail, or downward from the narrow horizontal toolbar.
  const courtSettings = (side: "right" | "bottom") => (
    <CourtSettings
      side={side}
      mode={draft.mode}
      onModeChange={(mode) => set((d) => ({ ...d, mode }))}
      grid={grid}
      onGridChange={setGrid}
      snap={snapOn}
      onSnapChange={setSnapOn}
      autoArrows={
        sequence ? { value: draft.autoArrows, onChange: (on) => set((d) => ({ ...d, autoArrows: on })) } : undefined
      }
    />
  );

  return (
    <div
      className="mx-auto flex w-full min-w-0 max-w-[1320px] flex-col gap-[clamp(0.75rem,2vh,1.25rem)] animate-[rise_0.6s_0.05s_var(--ease-settle)_both] motion-reduce:animate-none"
      onBlur={commit}
    >
      <div className="flex items-center gap-4">
        <Input
          variant="title"
          value={draft.title}
          placeholder="Untitled board"
          aria-label="Board title"
          onChange={(event) => replace((d) => ({ ...d, title: event.target.value }))}
        />
        <IconButton aria-label="Undo" tooltip="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
          <Undo2 size={16} aria-hidden="true" />
        </IconButton>
        <IconButton aria-label="Redo" tooltip="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}>
          <Redo2 size={16} aria-hidden="true" />
        </IconButton>
        <Button variant="text" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" disabled={saving} onClick={() => void done()}>
          {saving ? "Saving…" : doneLabel}
        </Button>
      </div>

      {/* The board's tags, quiet and out of the way under the title. */}
      <div className="-mt-1">
        <Combobox value={draft.tags} onChange={(tags) => set((d) => ({ ...d, tags }))} suggestions={tagSuggestions} />
      </div>

      {saveError && (
        <p role="alert" className="text-sm text-danger">
          Couldn’t save: {saveError}. Your changes are still here — press Done to retry.
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,calc(min(74vh,620px)_+_54px))_minmax(0,1fr)] items-start gap-[clamp(1rem,3vw,2rem)] max-[1040px]:grid-cols-[minmax(0,1fr)]">
        <div className="flex min-w-0 items-start justify-center gap-3">
          {wide && (
            <AnnotationToolbar
              tool={tool}
              onToolChange={changeTool}
              orientation="vertical"
              settings={courtSettings("right")}
            />
          )}

          <div className="flex w-full min-w-0 max-w-[min(74vh,620px)] flex-col items-center gap-[clamp(0.75rem,2vh,1.25rem)]">
            <div className="relative w-full">
              <CourtFrame
                ref={frameRef}
                tabIndex={0}
                aria-label="Court editor"
                className="relative"
                width="w-full"
                onKeyDown={onKeyDown}
                onKeyUp={commit}
              >
                <Court
                  markers={markers}
                  arrows={arrows}
                  annotations={annotations}
                  warnings={warnings}
                  grid={grid}
                  snap={snap}
                  label={draft.title || "Untitled board"}
                  selectedId={selectedId}
                  onSelect={select}
                  onMove={move}
                  tool={tool}
                  annotationStyle={annotationStyle}
                  selectedAnnotationId={selectedAnnotationId}
                  onSelectAnnotation={setSelectedAnnotationId}
                  onDrawAnnotation={drawAnnotation}
                  onTranslateAnnotation={translate}
                  onReshapeAnnotation={reshape}
                  annotationSnap={annotationSnap}
                  onGestureEnd={commit}
                />
                {editingText?.kind === "text" && (
                  <input
                    className={TEXT_OVERLAY}
                    style={{ left: framePercent(editingText.at.x), top: framePercent(editingText.at.y) }}
                    value={editingText.text}
                    placeholder="Label"
                    aria-label="Text label"
                    autoFocus
                    onChange={(event) =>
                      replace((d) => updateAnnotation(d, activeStepId, editingText.id, { text: event.target.value }))
                    }
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Escape") textCancelled.current = true;
                      if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur();
                    }}
                    onBlur={() => finishTextEdit(editingText.text)}
                  />
                )}
              </CourtFrame>

              {/* The contextual inspector floats over the court's top-right corner at wide widths, so
                  selecting a marker or arming a tool never reflows the page; below the breakpoint it
                  drops back into the flow under the court. It sits outside the focusable figure so
                  typing in it never nudges a marker. */}
              {(selected || tool !== "markers" || selectedAnnotation) && (
                <div className="absolute right-3 top-3 z-20 w-[300px] rounded-xl shadow-overlay max-[1040px]:static max-[1040px]:mt-[clamp(0.75rem,2vh,1.25rem)] max-[1040px]:w-full max-[1040px]:shadow-none">
                  {selected && (
                    <MarkerInspector
                      marker={selected}
                      mode={draft.mode}
                      onChangeRole={(role) => set((d) => setMarker(d, selected.id, { role }))}
                      onChangeColor={(color) => set((d) => setMarker(d, selected.id, { color }))}
                      onChangeLabel={(label) =>
                        replace((d) => setMarker(d, selected.id, { label: label.trim() === "" ? undefined : label }))
                      }
                      onDelete={() => {
                        set((d) => removeMarker(d, selected.id));
                        setSelectedId(null);
                      }}
                    />
                  )}
                  {(tool !== "markers" || selectedAnnotation) && (
                    <AnnotationInspector
                      style={selectedAnnotation ?? annotationStyle}
                      selected={Boolean(selectedAnnotation)}
                      fill={
                        selectedAnnotation
                          ? hasFill(selectedAnnotation)
                            ? selectedAnnotation.fill
                            : undefined
                          : isFillTool(tool)
                            ? annotationStyle.fill
                            : undefined
                      }
                      dash={
                        selectedAnnotation
                          ? hasDash(selectedAnnotation)
                            ? (selectedAnnotation.dash ?? "solid")
                            : undefined
                          : isDashTool(tool)
                            ? annotationStyle.dash
                            : undefined
                      }
                      onChangeColor={(color) => styleAnnotation({ color })}
                      onChangeWidth={(width) => styleAnnotation({ width })}
                      onChangeFill={(fill) => styleAnnotation({ fill })}
                      onChangeDash={(dash) => styleAnnotation({ dash })}
                      onRemove={
                        selectedAnnotation
                          ? () => {
                              set((d) => removeAnnotation(d, activeStepId, selectedAnnotation.id));
                              setSelectedAnnotationId(null);
                            }
                          : undefined
                      }
                    />
                  )}
                </div>
              )}
            </div>

            {/* The multi-click polygon gesture is the one tool whose finish isn't obvious, so spell it
                out while it is armed (a hover tooltip would never surface on touch). */}
            {tool === "polygon" && (
              <p className="m-0 text-center text-sm text-text-dim">
                Click to place corners. Finish on the first or last corner, by double-clicking, or with Enter. Esc
                cancels.
              </p>
            )}

            {sequence ? (
              <StepStrip
                steps={draft.steps}
                current={stepIndex}
                onSelect={(i) => setActiveStepId(draft.steps[i]?.id ?? draft.steps[0].id)}
                onAdd={appendStep}
                onRemove={deleteStep}
                onMove={(from, to) => set((d) => moveStep(d, from, to))}
              />
            ) : (
              <Button variant="dashed" onClick={appendStep} aria-label="Add step">
                + Add step
              </Button>
            )}

            {sequence && stepIndex < draft.steps.length - 1 && annotations.length > 0 && (
              <Button variant="text" size="sm" onClick={() => set((d) => copyAnnotationsToNextStep(d, stepIndex))}>
                Copy drawings to next step
              </Button>
            )}

            {!wide && <AnnotationToolbar tool={tool} onToolChange={changeTool} settings={courtSettings("bottom")} />}

            <MarkerPalette mode={draft.mode} onAdd={add} />
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 max-[1040px]:w-full">
          <RotationPanel
            draft={draft}
            stepIndex={stepIndex}
            violations={violations}
            onChangeRotation={changeRotation}
            onPlace={place}
            onChangeStrict={(rotationStrict) => set((d) => ({ ...d, rotationStrict }))}
          />
          <DescriptionEditor
            value={draft.description}
            onChange={(description) => replace((d) => ({ ...d, description }))}
          />
          {sequence && (
            <DescriptionEditor
              key={activeStep.id}
              title={`Step ${stepIndex + 1} instruction`}
              value={activeStep.instruction}
              onChange={(value) => replace((d) => setStepInstruction(d, activeStepId, value))}
              placeholder="What happens on this step? (markdown)"
            />
          )}
        </aside>
      </div>
    </div>
  );
}
