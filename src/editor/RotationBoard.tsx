import type { JSX } from "react";

import { OFFICIAL_SPOTS, ROTATION_SLOTS, presetAssignment, rotationPlayers } from "../boards/rotation";
import type { BoardMarker, RotationSlot, StepRotation } from "../boards/types";
import type { CourtCue } from "../court/Court";
import { RotationDiagram } from "../court/RotationDiagram";

// The board-model adapter for the rotation diagram: it resolves a step's rotation into the six
// official spots and their occupants. With a 1–6 preset the diagram is a read-only preview; in a
// custom rotation (when `onPlace` is given) it is the drag-to-spot assignment surface; the view
// passes `cue`/`onSelect` instead, so the diagram mirrors the court's tap cue.

type RotationBoardProps = {
  markers: readonly BoardMarker[];
  rotation: StepRotation;
  /** Provided for a custom rotation: place a marker on a spot, or back on the bench with `null`. */
  onPlace?: (markerId: string, slot: RotationSlot | null) => void;
  /** View mode: tapping a disc reports it, tapping the surface reports null (the cue). */
  onSelect?: (id: string | null) => void;
  /** The court's "who do I key off" cue, mirrored on the diagram. */
  cue?: CourtCue;
};

export function RotationBoard({ markers, rotation, onPlace, onSelect, cue }: RotationBoardProps): JSX.Element {
  const ids = new Set(markers.map((m) => m.id));
  const assignment: Partial<Record<RotationSlot, string>> =
    rotation.kind === "preset"
      ? (presetAssignment(markers, rotation.rotation) ?? {})
      : Object.fromEntries(Object.entries(rotation.assignment).filter(([, id]) => id !== undefined && ids.has(id)));

  const spots = ROTATION_SLOTS.map((slot) => ({
    label: String(slot),
    point: OFFICIAL_SPOTS[slot],
    marker: markers.find((m) => m.id === assignment[slot]),
  }));

  const placed = new Set(Object.values(assignment));
  const bench = onPlace ? rotationPlayers(markers).filter((m) => !placed.has(m.id)) : [];

  return (
    <figure className="m-0 w-full overflow-hidden rounded-2xl border border-border bg-court-surface">
      <RotationDiagram
        spots={spots}
        bench={bench}
        label="Rotation board"
        onPlace={onPlace && ((markerId, index) => onPlace(markerId, index === null ? null : ROTATION_SLOTS[index]))}
        onSelect={onSelect}
        cue={cue}
      />
    </figure>
  );
}
