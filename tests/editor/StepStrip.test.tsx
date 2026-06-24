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

// Each chip's slot centre is read from getBoundingClientRect().left + offsetWidth / 2; happy-dom returns
// zero for both, collapsing every slot to 0. Lay the chips out on a 100px grid so the drag can target a
// distinct slot per pointer position.
function layOutChips(): void {
  [1, 2, 3, 4]
    .map((n) => screen.getByLabelText(`Step ${n}`).parentElement as HTMLElement)
    .forEach((chip, i) => {
      chip.getBoundingClientRect = () => ({ left: i * 100, width: 80 }) as DOMRect;
      Object.defineProperty(chip, "offsetWidth", { configurable: true, value: 80 });
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
    fireEvent.pointerDown(button, { button: 0, clientX: 40, pointerId: 1 });
    fireEvent.pointerMove(button, { clientX: 140, pointerId: 1 }); // nearest slot 1
    fireEvent.pointerMove(button, { clientX: 240, pointerId: 1 }); // nearest slot 2
    fireEvent.pointerMove(button, { clientX: 340, pointerId: 1 }); // nearest slot 3
    fireEvent.pointerUp(button, { pointerId: 1 });

    // The drag crossed three slots, so the order changed and the gesture recorded an undo entry.
    expect(screen.queryByText(`Order: ${order}`)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();

    // One undo restores the original order: the whole drag is a single history entry, not one per slot.
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText(`Order: ${order}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  });
});
