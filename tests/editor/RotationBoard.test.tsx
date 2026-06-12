import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import type { BoardMarker } from "../../src/boards/types";
import type { MarkerRole } from "../../src/court/roles";
import { RotationBoard } from "../../src/editor/RotationBoard";

const m = (id: string, role: MarkerRole, label?: string): BoardMarker => ({ id, role, label });

const FIVE_ONE = [
  m("s", "setter"),
  m("oh1", "outside", "OH1"),
  m("oh2", "outside", "OH2"),
  m("mb1", "middle", "MB1"),
  m("mb2", "middle", "MB2"),
  m("opp", "opposite"),
];

// The diagram's zone grid spans 540×540 SVG units inside a 28-unit pad, and happy-dom maps client
// coordinates straight onto SVG units (an identity CTM).
const client = (x: number, y: number) => ({ clientX: 28 + x * 540, clientY: 28 + y * 540 });

describe("RotationBoard preset", () => {
  test("renders six labelled discs, each with its position numeral, and no empty spots", () => {
    const { container } = render(<RotationBoard markers={FIVE_ONE} rotation={{ kind: "preset", rotation: 1 }} />);

    for (const label of ["S", "OH1", "MB1", "OPP", "OH2", "MB2"]) expect(screen.getByText(label)).toBeInTheDocument();
    for (const numeral of ["1", "2", "3", "4", "5", "6"]) expect(screen.getByText(numeral)).toBeInTheDocument();
    expect(container.querySelectorAll(".court-spot")).toHaveLength(0);
  });
});

describe("RotationBoard custom", () => {
  test("renders the empty spots and assigns a benched player by dragging it onto one", () => {
    const onPlace = vi.fn();
    const { container } = render(
      <RotationBoard markers={FIVE_ONE} rotation={{ kind: "custom", assignment: {} }} onPlace={onPlace} />
    );

    expect(container.querySelectorAll(".court-spot")).toHaveLength(6);

    const svg = screen.getByLabelText("Rotation board");

    fireEvent.pointerDown(screen.getByLabelText("Setter"), { pointerId: 1, ...client(0.08, 1.2) });
    fireEvent.pointerMove(svg, { pointerId: 1, ...client(0.8, 0.72) }); // zone 1: back-row right
    fireEvent.pointerUp(svg, { pointerId: 1 });

    expect(onPlace).toHaveBeenCalledWith("s", 1);
  });

  test("dragging a placed player away from every spot benches it", () => {
    const onPlace = vi.fn();

    render(
      <RotationBoard markers={FIVE_ONE} rotation={{ kind: "custom", assignment: { 1: "s" } }} onPlace={onPlace} />
    );

    const svg = screen.getByLabelText("Rotation board");

    fireEvent.pointerDown(screen.getByLabelText("Setter"), { pointerId: 1, ...client(0.8, 0.72) });
    fireEvent.pointerMove(svg, { pointerId: 1, ...client(0.95, 1.2) });
    fireEvent.pointerUp(svg, { pointerId: 1 });

    expect(onPlace).toHaveBeenCalledWith("s", null);
  });
});
