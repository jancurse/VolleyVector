import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { createBoard, insertStep } from "../../src/boards/operations";
import { useDraftHistory } from "../../src/editor/useDraftHistory";

function setup() {
  return renderHook(() => useDraftHistory(createBoard(0, "positions", "Original")));
}

describe("useDraftHistory", () => {
  test("set records one entry and undo/redo round-trips it", () => {
    const { result } = setup();

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);

    act(() => result.current.set((b) => ({ ...b, title: "Edited" })));
    expect(result.current.draft.title).toBe("Edited");
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.draft.title).toBe("Original");
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.draft.title).toBe("Edited");
  });

  test("a replace burst commits as a single entry", () => {
    const { result } = setup();

    act(() => result.current.replace((b) => ({ ...b, title: "E" })));
    act(() => result.current.replace((b) => ({ ...b, title: "Ed" })));
    act(() => result.current.replace((b) => ({ ...b, title: "Edit" })));
    expect(result.current.canUndo).toBe(false); // nothing recorded mid-gesture

    act(() => result.current.commit());
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.draft.title).toBe("Original");
    expect(result.current.canUndo).toBe(false); // one entry, not three
  });

  test("a no-op gesture commits nothing", () => {
    const { result } = setup();

    act(() => result.current.replace((b) => b));
    act(() => result.current.commit());
    act(() => result.current.commit()); // idle commit is harmless too
    expect(result.current.canUndo).toBe(false);
  });

  test("a new set clears the future", () => {
    const { result } = setup();

    act(() => result.current.set((b) => ({ ...b, title: "One" })));
    act(() => result.current.undo());
    act(() => result.current.set((b) => ({ ...b, title: "Two" })));
    expect(result.current.canRedo).toBe(false);
    expect(result.current.draft.title).toBe("Two");
  });

  test("undo restores the active step recorded with the edit", () => {
    const { result } = setup();
    const firstStepId = result.current.draft.steps[0].id;

    let insertedId = "";

    act(() => {
      result.current.set((b) => {
        const { board, stepId } = insertStep(b, 0);

        insertedId = stepId;

        return board;
      });
    });
    act(() => result.current.setActiveStepId(insertedId));
    expect(result.current.activeStepId).toBe(insertedId);

    // Deleting the active step: the edit snapshots it as active, navigation after is unrecorded.
    act(() => result.current.set((b) => ({ ...b, steps: b.steps.filter((s) => s.id !== insertedId) })));
    act(() => result.current.setActiveStepId(firstStepId));

    act(() => result.current.undo());
    expect(result.current.draft.steps).toHaveLength(2);
    expect(result.current.activeStepId).toBe(insertedId);
  });

  test("the history caps at 100 entries, dropping the oldest", () => {
    const { result } = setup();

    for (let i = 0; i < 110; i++) {
      act(() => result.current.set((b) => ({ ...b, title: `Edit ${i}` })));
    }

    for (let i = 0; i < 105; i++) {
      act(() => result.current.undo());
    }

    // Only 100 undos applied; the oldest snapshots were dropped, never blocking undo midway.
    expect(result.current.canUndo).toBe(false);
    expect(result.current.draft.title).toBe("Edit 9");
  });
});
