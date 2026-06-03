import { describe, expect, test } from "vitest";

import {
  addMarker,
  boardsInTopic,
  createBoard,
  insertStep,
  makeMarker,
  moveBoardWithinTopic,
  moveStep,
  nextLabel,
  nextTopicOrder,
  removeMarker,
  removeStep,
  setMarker,
  setStepInstruction,
  setStepPosition,
  stepMarkers,
  stepMoves,
} from "../../src/boards/operations";
import type { Board } from "../../src/boards/types";
import { isSequence } from "../../src/boards/types";
import type { MarkerRole } from "../../src/court/roles";
import type { Marker } from "../../src/court/types";

const MARKERS: Marker[] = [
  { id: "a", role: "outside", label: "OH1", position: { x: 0.2, y: 0.2 } },
  { id: "b", role: "setter", label: "S", position: { x: 0.5, y: 0.5 } },
];

// A two-step board (a Sequence): marker "a" holds still, marker "b" slides right between the steps.
const SEQUENCE: Board = {
  id: "d",
  title: "Test",
  description: "",
  mode: "positions",
  markers: [
    { id: "a", role: "outside", label: "OH1" },
    { id: "b", role: "setter", label: "S" },
  ],
  steps: [
    { id: "s1", instruction: "one", positions: { a: { x: 0.2, y: 0.2 }, b: { x: 0.5, y: 0.5 } } },
    { id: "s2", instruction: "two", positions: { a: { x: 0.2, y: 0.2 }, b: { x: 0.8, y: 0.5 } } },
  ],
  tags: [],
  topicId: null,
  topicOrder: 0,
  createdAt: 0,
  updatedAt: 0,
};

// Three Positions filed under one topic in a deliberate manual order, plus one Unfiled.
function filed(id: string, topicId: string | null, topicOrder: number): Board {
  return {
    id,
    title: id,
    description: "",
    mode: "positions",
    markers: [],
    steps: [{ id: "s1", instruction: "", positions: {} }],
    tags: [],
    topicId,
    topicOrder,
    createdAt: 0,
    updatedAt: 0,
  };
}

const FILED: Board[] = [filed("c", "t1", 2), filed("a", "t1", 0), filed("b", "t1", 1), filed("x", null, 0)];

describe("nextLabel", () => {
  test.each<[MarkerRole, string]>([
    ["outside", "OH2"], // numbered role, one already present
    ["middle", "MB1"], // numbered role, first of its kind
    ["setter", "S2"], // singular role, but a second copy is numbered
    ["libero", "L"], // singular role, first of its kind stays bare
  ])("labels a new %s as %s", (role, expected) => {
    expect(nextLabel(role, MARKERS)).toBe(expected);
  });

  test("leaves the ball unlabelled", () => {
    expect(nextLabel("ball", MARKERS)).toBeUndefined();
  });
});

describe("makeMarker", () => {
  test("builds a labelled marker on the bench below the court", () => {
    const marker = makeMarker("middle", MARKERS);

    expect(marker).toMatchObject({ role: "middle", label: "MB1" });
    expect(marker.position.y).toBeGreaterThan(1); // on the bench, below the end line
  });

  test("fills the leftmost free bench slot, reusing slots vacated onto the court", () => {
    const first = makeMarker("player", []);
    const second = makeMarker("player", [first]);

    expect(second.position.x).toBeGreaterThan(first.position.x);

    // Once `first` is dragged onto the court (y < 1) its bench slot frees up again.
    const onCourt = { ...first, position: { x: 0.5, y: 0.5 } };

    expect(makeMarker("player", [onCourt]).position.x).toBe(first.position.x);
  });

  test("gives each new marker a distinct id", () => {
    expect(makeMarker("setter", MARKERS).id).not.toBe(makeMarker("setter", MARKERS).id);
  });
});

describe("createBoard", () => {
  test("starts as a single-step Position, empty in the given mode, stamping the time", () => {
    const board = createBoard(1234, "basic", "Press");

    expect(board).toMatchObject({ title: "Press", mode: "basic", markers: [], createdAt: 1234, updatedAt: 1234 });
    expect(board).toMatchObject({ topicId: null, topicOrder: 0 }); // a fresh board is Unfiled
    expect(board.steps).toHaveLength(1);
    expect(board.steps[0]).toMatchObject({ instruction: "", positions: {} });
    expect(isSequence(board)).toBe(false);
  });

  test("defaults to positions mode and an untitled board", () => {
    expect(createBoard(0)).toMatchObject({ mode: "positions", title: "Untitled board" });
  });
});

describe("isSequence", () => {
  test("inserting a step promotes a Position to a Sequence; removing back to one demotes it", () => {
    const { board: promoted, stepId } = insertStep(createBoard(0), 0);

    expect(isSequence(promoted)).toBe(true);
    expect(isSequence(removeStep(promoted, stepId))).toBe(false);
  });
});

describe("stepMarkers", () => {
  test("builds full markers from a step's positions, by identity", () => {
    expect(stepMarkers(SEQUENCE, 1).find((m) => m.id === "b")).toMatchObject({
      role: "setter",
      label: "S",
      position: { x: 0.8, y: 0.5 },
    });
  });

  test("returns nothing for an out-of-range step", () => {
    expect(stepMarkers(SEQUENCE, 9)).toEqual([]);
  });
});

describe("stepMoves", () => {
  test("derives only the markers that moved to the next step", () => {
    expect(stepMoves(SEQUENCE, 0)).toEqual([{ id: "b", from: { x: 0.5, y: 0.5 }, to: { x: 0.8, y: 0.5 } }]);
  });

  test("has no moves out of the last step", () => {
    expect(stepMoves(SEQUENCE, 1)).toEqual([]);
  });
});

describe("insertStep", () => {
  test("inserts after the given step, cloning its positions, without mutating the input", () => {
    const { board, stepId } = insertStep(SEQUENCE, 0);

    expect(board.steps).toHaveLength(3);
    expect(board.steps[1].id).toBe(stepId); // inserted directly after step 0
    expect(board.steps[1].positions).toEqual(SEQUENCE.steps[0].positions);
    expect(board.steps[1].positions).not.toBe(SEQUENCE.steps[0].positions);
    expect(board.steps[1].instruction).toBe("");
    expect(SEQUENCE.steps).toHaveLength(2);
  });
});

describe("moveStep", () => {
  test("reorders a step to a new index", () => {
    expect(moveStep(SEQUENCE, 0, 1).steps.map((s) => s.id)).toEqual(["s2", "s1"]);
  });

  test("is a no-op for an unchanged or out-of-range index", () => {
    expect(moveStep(SEQUENCE, 0, 0)).toBe(SEQUENCE);
    expect(moveStep(SEQUENCE, 0, 5)).toBe(SEQUENCE);
  });
});

describe("removeStep", () => {
  test("removes the named step", () => {
    expect(removeStep(SEQUENCE, "s1").steps.map((s) => s.id)).toEqual(["s2"]);
  });

  test("never removes the last remaining step", () => {
    const single = createBoard(0);

    expect(removeStep(single, single.steps[0].id)).toBe(single);
  });
});

describe("setStepInstruction", () => {
  test("edits only the named step", () => {
    const result = setStepInstruction(SEQUENCE, "s2", "edited");

    expect(result.steps[1].instruction).toBe("edited");
    expect(result.steps[0].instruction).toBe("one");
  });
});

describe("setStepPosition", () => {
  test("moves a marker on one step only", () => {
    const result = setStepPosition(SEQUENCE, "s1", "a", { x: 0.9, y: 0.9 });

    expect(result.steps[0].positions.a).toEqual({ x: 0.9, y: 0.9 });
    expect(result.steps[1].positions.a).toEqual({ x: 0.2, y: 0.2 });
  });
});

describe("addMarker", () => {
  test("adds a labelled identity and a bench position on every step", () => {
    const { board, markerId } = addMarker(SEQUENCE, "middle", 0);

    expect(board.markers).toHaveLength(3);
    expect(board.markers.find((m) => m.id === markerId)).toMatchObject({ role: "middle", label: "MB1" });
    for (const step of board.steps) {
      expect(step.positions[markerId].y).toBeGreaterThan(1); // benched below the end line
    }
  });
});

describe("setMarker", () => {
  test("patches a marker's identity across the board, leaving positions untouched", () => {
    const result = setMarker(SEQUENCE, "a", { role: "libero", label: "L" });

    expect(result.markers.find((m) => m.id === "a")).toMatchObject({ role: "libero", label: "L" });
    expect(result.steps[0].positions.a).toEqual({ x: 0.2, y: 0.2 });
    expect(SEQUENCE.markers.find((m) => m.id === "a")?.role).toBe("outside");
  });
});

describe("removeMarker", () => {
  test("drops the identity and its position on every step", () => {
    const result = removeMarker(SEQUENCE, "a");

    expect(result.markers.map((m) => m.id)).toEqual(["b"]);
    for (const step of result.steps) {
      expect(step.positions).not.toHaveProperty("a");
      expect(step.positions).toHaveProperty("b");
    }
  });
});

describe("boardsInTopic", () => {
  test("returns a topic's boards in manual order, ignoring the rest", () => {
    expect(boardsInTopic(FILED, "t1").map((b) => b.id)).toEqual(["a", "b", "c"]);
    expect(boardsInTopic(FILED, "missing")).toEqual([]);
  });
});

describe("nextTopicOrder", () => {
  test("appends after a topic's existing boards, and is 0 for Unfiled", () => {
    expect(nextTopicOrder(FILED, "t1")).toBe(3);
    expect(nextTopicOrder(FILED, "empty")).toBe(0);
    expect(nextTopicOrder(FILED, null)).toBe(0);
  });
});

describe("moveBoardWithinTopic", () => {
  test("swaps a board one place within its topic, persisting the new order", () => {
    const moved = moveBoardWithinTopic(FILED, "t1", "a", 1); // a (0) and b (1) swap orders

    expect(boardsInTopic(moved, "t1").map((b) => b.id)).toEqual(["b", "a", "c"]);
  });

  test("is a no-op past either end", () => {
    expect(moveBoardWithinTopic(FILED, "t1", "a", -1)).toBe(FILED);
    expect(moveBoardWithinTopic(FILED, "t1", "c", 1)).toBe(FILED);
  });
});
