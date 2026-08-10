import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, test } from "vitest";

import { createBoard, insertStep, moveStep } from "../../src/boards/operations";
import type { Board } from "../../src/boards/types";
import { StepStrip } from "../../src/editor/StepStrip";
import { useDraftHistory } from "../../src/editor/useDraftHistory";

// A four-step Sequence to drag across.
function fourStepBoard(): Board {
  let board = createBoard(0);

  for (let i = 0; i < 3; i++) board = insertStep(board, board.steps.length - 1).board;

  return board;
}

// Wire StepStrip to useDraftHistory exactly as BoardEditor does: a drag streams reorder frames through
// `replace` and collapses them into one undo entry at `onMoveEnd` → `commit`. The current step labels
// each chip and the undo/redo buttons expose the history state for assertions.
function Harness({ board }: { board: Board }) {
  const { draft, setActiveStepId, replace, commit, undo, canUndo } = useDraftHistory(board);
  const [current, setCurrent] = useState(0);

  return (
    <div>
      <StepStrip
        steps={draft.steps}
        current={current}
        onSelect={(i) => {
          setCurrent(i);
          setActiveStepId(draft.steps[i].id);
        }}
        onAdd={() => {}}
        onRemove={() => {}}
        onMove={(from, to) => replace((d) => moveStep(d, from, to))}
        onMoveEnd={commit}
      />
      <p>Order: {draft.steps.map((s) => s.id).join(",")}</p>
      <button onClick={undo} disabled={!canUndo}>
        Undo
      </button>
    </div>
  );
}

// Each chip's slot centre is read from its bounding rect; happy-dom returns zero for every side,
// collapsing all four slots onto one point. Lay the chips out by hand so the drag can target a distinct
// slot per pointer position: `perRow` chips of 80px on a 100px pitch, wrapping onto 50px-pitch rows.
function layOutChips(perRow = 4): void {
  [1, 2, 3, 4]
    .map((n) => screen.getByLabelText(`Step ${n}`).parentElement as HTMLElement)
    .forEach((chip, i) => {
      const rect = { left: (i % perRow) * 100, width: 80, top: Math.floor(i / perRow) * 50, height: 40 };

      chip.getBoundingClientRect = () => rect as DOMRect;
    });
}

describe("StepStrip drag reorder", () => {
  test("a drag across several slots collapses to a single undo entry", () => {
    const board = fourStepBoard();
    const order = board.steps.map((s) => s.id).join(",");

    render(<Harness board={board} />);
    expect(screen.getByText(`Order: ${order}`)).toBeInTheDocument();

    layOutChips();

    const button = screen.getByLabelText("Step 1");

    // Drag step 1 from slot 0 across slots 1 and 2 to slot 3 (chip centre 340).
    fireEvent.pointerDown(button, { button: 0, clientX: 40, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(button, { clientX: 140, clientY: 20, pointerId: 1 }); // nearest slot 1
    fireEvent.pointerMove(button, { clientX: 240, clientY: 20, pointerId: 1 }); // nearest slot 2
    fireEvent.pointerMove(button, { clientX: 340, clientY: 20, pointerId: 1 }); // nearest slot 3
    fireEvent.pointerUp(button, { pointerId: 1 });

    // The drag crossed three slots, so the order changed and the gesture recorded an undo entry.
    expect(screen.queryByText(`Order: ${order}`)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();

    // One undo restores the original order: the whole drag is a single history entry, not one per slot.
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText(`Order: ${order}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  });

  test("a drag onto a wrapped row targets the slot below, not the one sharing its column", () => {
    const board = fourStepBoard();
    const ids = board.steps.map((s) => s.id);

    render(<Harness board={board} />);
    layOutChips(2);

    // Two chips per row, so slot 2 sits directly below slot 0. Drag step 1 straight down onto it.
    const button = screen.getByLabelText("Step 1");

    fireEvent.pointerDown(button, { button: 0, clientX: 40, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(button, { clientX: 40, clientY: 70, pointerId: 1 });
    fireEvent.pointerUp(button, { pointerId: 1 });

    expect(screen.getByText(`Order: ${[ids[1], ids[2], ids[0], ids[3]].join(",")}`)).toBeInTheDocument();
  });

  test("an off-centre grab swaps where the chip lands, not where the pointer is", () => {
    const board = fourStepBoard();
    const ids = board.steps.map((s) => s.id);
    const order = ids.join(",");

    render(<Harness board={board} />);
    layOutChips();

    // Grab chip 1 (spanning 0..80, centre 40) by its right edge, so the pointer sits 36px right of the
    // chip's centre for the whole gesture.
    const button = screen.getByLabelText("Step 1");

    fireEvent.pointerDown(button, { button: 0, clientX: 76, clientY: 20, pointerId: 1 });

    // 15px of travel puts the chip's centre at 55, still deep inside its own slot. Matching the raw
    // pointer (91) would already have swapped it into slot 1.
    fireEvent.pointerMove(button, { clientX: 91, clientY: 20, pointerId: 1 });
    expect(screen.getByText(`Order: ${order}`)).toBeInTheDocument();

    // Carry the chip's centre onto slot 1 (140) and it swaps, so the grab offset delays nothing either.
    fireEvent.pointerMove(button, { clientX: 176, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(button, { pointerId: 1 });

    expect(screen.getByText(`Order: ${[ids[1], ids[0], ids[2], ids[3]].join(",")}`)).toBeInTheDocument();
  });
});
