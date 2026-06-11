import { useRef, useState } from "react";
import type { JSX } from "react";

import { OFFICIAL_SPOTS, ROTATION_SLOTS, presetAssignment, rotationPlayers } from "../boards/rotation";
import type { BoardMarker, RotationSlot, StepRotation } from "../boards/types";
import { Court } from "../court/Court";
import type { NormalizedPoint } from "../court/geometry";
import type { Marker } from "../court/types";

// The rotation board: a small court showing the six players on their official positions for the
// active rotation, with the same discs, labels, and colours as the actual board. With a 1–6 preset
// it is a read-only preview; in a custom rotation (when `onPlace` is given) it is the assignment
// surface — unassigned players sit benched below the court, and dragging one onto a spot assigns it.

// A drop within this normalized distance of an official spot assigns the marker to it; further away
// it returns to the bench.
const SPOT_REACH = 0.18;

// The bench row below the end line where unassigned players wait, mirroring the editor's bench.
const BENCH = (i: number): NormalizedPoint => ({ x: 0.09 + i * 0.13, y: 1.07 });

type RotationBoardProps = {
  markers: readonly BoardMarker[];
  rotation: StepRotation;
  /** Provided for a custom rotation: place a marker on a spot, or back on the bench with `null`. */
  onPlace?: (markerId: string, slot: RotationSlot | null) => void;
};

export function RotationBoard({ markers, rotation, onPlace }: RotationBoardProps): JSX.Element {
  const [dragPositions, setDragPositions] = useState<Record<string, NormalizedPoint>>({});
  const dragged = useRef<{ id: string; position: NormalizedPoint } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ids = new Set(markers.map((m) => m.id));
  const assignment: Partial<Record<RotationSlot, string>> =
    rotation.kind === "preset"
      ? (presetAssignment(markers, rotation.rotation) ?? {})
      : Object.fromEntries(Object.entries(rotation.assignment).filter(([, id]) => id !== undefined && ids.has(id)));

  const slotOf = (markerId: string) => ROTATION_SLOTS.find((slot) => assignment[slot] === markerId);

  const placed = new Set(Object.values(assignment));
  const bench = onPlace ? rotationPlayers(markers).filter((m) => !placed.has(m.id)) : [];

  const courtMarkers: Marker[] = [
    ...ROTATION_SLOTS.flatMap((slot) => {
      const marker = markers.find((m) => m.id === assignment[slot]);

      return marker ? [{ ...marker, position: dragPositions[marker.id] ?? OFFICIAL_SPOTS[slot] }] : [];
    }),
    ...bench.map((m, i) => ({ ...m, position: dragPositions[m.id] ?? BENCH(i) })),
  ];

  const spots = ROTATION_SLOTS.filter((slot) => !assignment[slot]).map((slot) => ({
    point: OFFICIAL_SPOTS[slot],
    label: String(slot),
  }));

  const move = (id: string, position: NormalizedPoint) => {
    dragged.current = { id, position };
    setDragPositions((p) => ({ ...p, [id]: position }));
  };

  // Releasing a drag assigns the marker to the nearest official spot in reach, or benches it. The
  // transient drag positions clear, so a refused placement simply snaps back.
  const drop = () => {
    if (!dragged.current) return;

    const { id, position } = dragged.current;
    const nearest = ROTATION_SLOTS.map((slot) => ({
      slot,
      distance: Math.hypot(OFFICIAL_SPOTS[slot].x - position.x, OFFICIAL_SPOTS[slot].y - position.y),
    })).sort((a, b) => a.distance - b.distance)[0];
    const slot = nearest.distance <= SPOT_REACH ? nearest.slot : null;

    if (slot !== slotOf(id)) onPlace?.(id, slot);

    dragged.current = null;
    setDragPositions({});
  };

  return (
    <figure className="m-0 aspect-square w-full rounded-2xl border border-border bg-court-surface">
      <Court
        markers={courtMarkers}
        spots={spots}
        label="Rotation board"
        selectedId={selectedId}
        onSelect={onPlace ? setSelectedId : undefined}
        onMove={onPlace ? move : undefined}
        onGestureEnd={onPlace ? drop : undefined}
      />
    </figure>
  );
}
