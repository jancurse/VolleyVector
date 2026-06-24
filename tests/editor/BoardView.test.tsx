import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { addMarker, createBoard, insertStep } from "../../src/boards/operations";
import { OFFICIAL_SPOTS, ROTATION_SLOTS, presetAssignment } from "../../src/boards/rotation";
import type { Board } from "../../src/boards/types";
import type { MarkerRole } from "../../src/court/roles";
import { BoardView } from "../../src/editor/BoardView";

const ROSTER: MarkerRole[] = ["setter", "outside", "outside", "middle", "libero", "opposite", "ball"];

function makeBoard({
  rotation = false,
  tags = [],
  steps = 1,
}: { rotation?: boolean; tags?: string[]; steps?: number } = {}): Board {
  let board = ROSTER.reduce((b, role) => addMarker(b, role, 0).board, createBoard(0));

  if (rotation) {
    // Park the six players on their official spots so rotation 1 is legal: selecting one then lights
    // clean cue edges rather than violation edges off the bench.
    const assignment = presetAssignment(board.markers, 1)!;
    const positions = {
      ...board.steps[0].positions,
      ...Object.fromEntries(ROTATION_SLOTS.map((slot) => [assignment[slot], OFFICIAL_SPOTS[slot]])),
    };

    board = { ...board, steps: [{ ...board.steps[0], positions, rotation: { kind: "preset", rotation: 1 } as const }] };
  }
  for (let i = 1; i < steps; i++) board = insertStep(board, 0).board;

  return { ...board, tags };
}

// Marker queries scope to the main court, since the rotation panel carries the same accessible names.
const court = () => within(screen.getByLabelText("Untitled board"));

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

  // In a Sequence the description scrolls internally so the panels beside the court stay visible; a
  // Position leaves it unbounded.
  test.each([
    [2, true],
    [1, false],
  ])("with %i steps the description caps its height: %s", (steps, capped) => {
    render(<BoardView board={makeBoard({ steps })} onBack={vi.fn()} />);

    const description = screen.getByRole("region", { name: "Description" });

    expect(description.querySelector(".overflow-y-auto") !== null).toBe(capped);
  });
});

describe("BoardView rotation links", () => {
  // Tapping an assigned player on either surface lights the same cue edges on both: the main court
  // and the rotation board mirror one selection.
  test.each([["Untitled board"], ["Rotation board"]])(
    "tapping an assigned player on %j links them to their neighbours on both boards; tapping the surface clears it",
    async (surface) => {
      const user = userEvent.setup();

      render(<BoardView board={makeBoard({ rotation: true })} onBack={vi.fn()} />);

      const main = screen.getByLabelText("Untitled board");

      await user.click(within(screen.getByLabelText(surface)).getByLabelText("Setter"));
      // In rotation 1 the setter keys off their front counterpart and their in-row neighbour.
      expect(main.querySelectorAll(".court-link--cue")).toHaveLength(2);
      expect(screen.getByLabelText("Rotation board").querySelectorAll(".court-link--cue")).toHaveLength(2);
      // On the main court the other three players and the ball step back.
      expect(main.querySelectorAll(".court-marker--dim")).toHaveLength(4);

      fireEvent.pointerDown(screen.getByLabelText(surface));
      expect(document.querySelectorAll(".court-link--cue")).toHaveLength(0);
      expect(document.querySelectorAll(".court-marker--dim")).toHaveLength(0);
    }
  );

  // A broken overlap relation shows a persistent red edge on both surfaces, with nothing selected and
  // nothing dimmed.
  test("a violation draws a persistent red edge on both boards without any selection", () => {
    const base = makeBoard({ rotation: true });
    const setterId = presetAssignment(base.markers, 1)![1];
    const positions = { ...base.steps[0].positions, [setterId]: { x: 0.8, y: 0.1 } }; // back, ahead of the net pair
    const board = { ...base, steps: [{ ...base.steps[0], positions }] };

    render(<BoardView board={board} onBack={vi.fn()} />);
    expect(screen.getByLabelText("Untitled board").querySelectorAll(".court-link--violation")).toHaveLength(1);
    expect(screen.getByLabelText("Rotation board").querySelectorAll(".court-link--violation")).toHaveLength(1);
    expect(document.querySelectorAll(".court-marker--dim")).toHaveLength(0);
  });

  test("tapping an unassigned marker (the ball) shows nothing", async () => {
    const user = userEvent.setup();
    const { container } = render(<BoardView board={makeBoard({ rotation: true })} onBack={vi.fn()} />);

    await user.click(court().getByLabelText("Ball"));
    expect(container.querySelectorAll(".court-link--cue")).toHaveLength(0);
  });

  test("without an active rotation the markers are inert", async () => {
    const user = userEvent.setup();
    const { container } = render(<BoardView board={makeBoard()} onBack={vi.fn()} />);

    await user.click(court().getByLabelText("Setter"));
    expect(container.querySelectorAll(".court-link--cue")).toHaveLength(0);
  });
});
