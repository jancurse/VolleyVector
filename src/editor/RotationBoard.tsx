import type { JSX } from "react";

import { OFFICIAL_SPOTS, ROTATION_SLOTS, presetAssignment, rotationPlayers } from "../boards/rotation";
import type { RotationLink } from "../boards/rotation";
import type { BoardMarker, RotationSlot, StepRotation } from "../boards/types";
import { RotationDiagram } from "../court/RotationDiagram";

// The board-model adapter for the rotation diagram: it resolves a step's rotation into the six
// official spots and their occupants. With a 1–6 preset the diagram is a read-only preview; in a
// custom rotation (when `onPlace` is given) it is the drag-to-spot assignment surface. It mirrors the
// court's selection and constraint edges through `selectedId`/`links`, and the view adds `onSelect`.

type RotationBoardProps = {
  markers: readonly BoardMarker[];
  rotation: StepRotation;
  /** Provided for a custom rotation: place a marker on a spot, or back on the bench with `null`. */
  onPlace?: (markerId: string, slot: RotationSlot | null) => void;
  /** View mode: tapping a disc reports it, tapping the surface reports null (clears the selection). */
  onSelect?: (id: string | null) => void;
  /** The selected player and the constraint edges, mirrored from the court. */
  selectedId?: string | null;
  links?: readonly RotationLink[];
};

export function RotationBoard({
  markers,
  rotation,
  onPlace,
  onSelect,
  selectedId,
  links,
}: RotationBoardProps): JSX.Element {
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
        selectedId={selectedId}
        links={links}
      />
    </figure>
  );
}
