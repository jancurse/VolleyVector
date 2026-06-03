import { useCallback, useRef, useState } from "react";
import type { JSX, KeyboardEvent } from "react";

import { Court } from "../court/Court";
import { clampToCourt } from "../court/geometry";
import type { NormalizedPoint } from "../court/geometry";
import type { MarkerRole } from "../court/roles";
import { makeMarker, removeMarker, setMarker } from "../tactics/operations";
import type { Tactic } from "../tactics/types";
import { DescriptionEditor } from "./DescriptionEditor";
import { MarkerInspector } from "./MarkerInspector";
import { MarkerPalette } from "./MarkerPalette";

const NUDGE = 0.01;
const NUDGE_LARGE = 0.05;
const ARROW_DELTAS: Record<string, NormalizedPoint> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

// Edits a working draft of the tactic. Nothing leaves the editor until "Done" commits the draft;
// "Cancel" discards it. The draft is seeded from the `tactic` prop on mount (the parent remounts
// the editor per session via a key), so the editor owns all in-progress state.
type TacticEditorProps = {
  tactic: Tactic;
  onDone: (tactic: Tactic) => void;
  onCancel: () => void;
  /** Omitted for a brand-new tactic that has nothing to delete yet. */
  onDelete?: () => void;
};

export function TacticEditor({ tactic, onDone, onCancel, onDelete }: TacticEditorProps): JSX.Element {
  const [draft, setDraft] = useState(tactic);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const frameRef = useRef<HTMLElement>(null);
  const selected = draft.markers.find((m) => m.id === selectedId) ?? null;

  const update = useCallback((fn: (tactic: Tactic) => Tactic) => setDraft(fn), []);

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id !== null) frameRef.current?.focus();
  }, []);

  const move = useCallback(
    (id: string, position: NormalizedPoint) =>
      update((t) => ({ ...t, markers: setMarker(t.markers, id, { position }) })),
    [update]
  );

  const add = useCallback(
    (role: MarkerRole) => {
      const marker = makeMarker(role, draft.markers);

      update((t) => ({ ...t, markers: [...t.markers, marker] }));
      setSelectedId(marker.id);
      frameRef.current?.focus();
    },
    [update, draft.markers]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const delta = ARROW_DELTAS[event.key];

      if (!selected || !delta) return;

      event.preventDefault();
      const step = event.shiftKey ? NUDGE_LARGE : NUDGE;

      move(
        selected.id,
        clampToCourt({ x: selected.position.x + delta.x * step, y: selected.position.y + delta.y * step })
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
          placeholder="Untitled tactic"
          aria-label="Tactic title"
          onChange={(event) => update((t) => ({ ...t, title: event.target.value }))}
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
              markers={draft.markers}
              label={draft.title || "Untitled tactic"}
              selectedId={selectedId}
              onSelect={select}
              onMove={move}
            />
          </figure>
          <div className="vc-segmented" role="group" aria-label="Court mode">
            {(["positions", "basic"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`vc-seg${draft.mode === m ? " vc-seg--on" : ""}`}
                aria-pressed={draft.mode === m}
                onClick={() => update((t) => ({ ...t, mode: m }))}
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
              onChangeRole={(role) => update((t) => ({ ...t, markers: setMarker(t.markers, selected.id, { role }) }))}
              onChangeColor={(color) =>
                update((t) => ({ ...t, markers: setMarker(t.markers, selected.id, { color }) }))
              }
              onChangeLabel={(label) =>
                update((t) => ({
                  ...t,
                  markers: setMarker(t.markers, selected.id, { label: label.trim() === "" ? undefined : label }),
                }))
              }
              onDelete={() => {
                update((t) => ({ ...t, markers: removeMarker(t.markers, selected.id) }));
                setSelectedId(null);
              }}
            />
          )}
          <DescriptionEditor
            value={draft.description}
            onChange={(description) => update((t) => ({ ...t, description }))}
          />
        </aside>
      </div>
    </div>
  );
}
