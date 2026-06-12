import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { addMarker, createBoard } from "../../src/boards/operations";
import type { Board } from "../../src/boards/types";
import type { MarkerRole } from "../../src/court/roles";
import { BoardView } from "../../src/editor/BoardView";

const ROSTER: MarkerRole[] = ["setter", "outside", "outside", "middle", "libero", "opposite"];

function makeBoard({ rotation = false, tags = [] }: { rotation?: boolean; tags?: string[] } = {}): Board {
  const base = ROSTER.reduce((b, role) => addMarker(b, role, 0).board, createBoard(0));
  const steps = rotation ? [{ ...base.steps[0], rotation: { kind: "preset", rotation: 1 } as const }] : base.steps;

  return { ...base, steps, tags };
}

describe("BoardView", () => {
  test("a step with an active rotation shows the rotation panel beside the court", () => {
    render(<BoardView board={makeBoard({ rotation: true })} onBack={vi.fn()} />);

    expect(screen.getByText("Rotation 1")).toBeInTheDocument();
  });

  test("a step without a rotation shows no rotation panel", () => {
    render(<BoardView board={makeBoard()} onBack={vi.fn()} />);

    expect(screen.queryByText(/Rotation/)).not.toBeInTheDocument();
  });

  test.each([
    [["serve receive", "5-1"], true],
    [[], false],
  ])("tags %j render under the title: %s", (tags, shown) => {
    render(<BoardView board={makeBoard({ tags })} onBack={vi.fn()} />);

    expect(screen.queryByText("serve receive") !== null).toBe(shown);
  });
});
