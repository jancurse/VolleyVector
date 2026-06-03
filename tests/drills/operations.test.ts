import { describe, expect, test } from "vitest";

import {
  addMarker,
  createDrill,
  insertStep,
  moveStep,
  removeMarker,
  removeStep,
  setMarker,
  setStepInstruction,
  setStepPosition,
  stepMarkers,
  stepMoves,
} from "../../src/drills/operations";
import type { Drill } from "../../src/drills/types";

// A two-step drill: marker "a" holds still, marker "b" slides right between the steps.
const DRILL: Drill = {
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
  createdAt: 0,
  updatedAt: 0,
};

describe("createDrill", () => {
  test("starts with one empty step in the given mode and stamps the time", () => {
    const drill = createDrill(1234, "basic", "Press");

    expect(drill).toMatchObject({ title: "Press", mode: "basic", markers: [], createdAt: 1234, updatedAt: 1234 });
    expect(drill.steps).toHaveLength(1);
    expect(drill.steps[0]).toMatchObject({ instruction: "", positions: {} });
  });

  test("defaults to positions mode and an untitled drill", () => {
    expect(createDrill(0)).toMatchObject({ mode: "positions", title: "Untitled drill" });
  });
});

describe("stepMarkers", () => {
  test("builds full markers from a step's positions, by identity", () => {
    const markers = stepMarkers(DRILL, 1);

    expect(markers.find((m) => m.id === "b")).toMatchObject({
      role: "setter",
      label: "S",
      position: { x: 0.8, y: 0.5 },
    });
  });

  test("returns nothing for an out-of-range step", () => {
    expect(stepMarkers(DRILL, 9)).toEqual([]);
  });
});

describe("stepMoves", () => {
  test("derives only the markers that moved to the next step", () => {
    const moves = stepMoves(DRILL, 0);

    expect(moves).toEqual([{ id: "b", from: { x: 0.5, y: 0.5 }, to: { x: 0.8, y: 0.5 } }]);
  });

  test("has no moves out of the last step", () => {
    expect(stepMoves(DRILL, 1)).toEqual([]);
  });
});

describe("insertStep", () => {
  test("inserts after the given step, cloning its positions, without mutating the input", () => {
    const { drill, stepId } = insertStep(DRILL, 0);

    expect(drill.steps).toHaveLength(3);
    expect(drill.steps[1].id).toBe(stepId); // inserted directly after step 0
    expect(drill.steps[1].positions).toEqual(DRILL.steps[0].positions);
    expect(drill.steps[1].positions).not.toBe(DRILL.steps[0].positions);
    expect(drill.steps[1].instruction).toBe("");
    expect(DRILL.steps).toHaveLength(2);
  });
});

describe("moveStep", () => {
  test("reorders a step to a new index", () => {
    expect(moveStep(DRILL, 0, 1).steps.map((s) => s.id)).toEqual(["s2", "s1"]);
  });

  test("is a no-op for an unchanged or out-of-range index", () => {
    expect(moveStep(DRILL, 0, 0)).toBe(DRILL);
    expect(moveStep(DRILL, 0, 5)).toBe(DRILL);
  });
});

describe("removeStep", () => {
  test("removes the named step", () => {
    expect(removeStep(DRILL, "s1").steps.map((s) => s.id)).toEqual(["s2"]);
  });

  test("never removes the last remaining step", () => {
    const single = createDrill(0);

    expect(removeStep(single, single.steps[0].id)).toBe(single);
  });
});

describe("setStepInstruction", () => {
  test("edits only the named step", () => {
    const result = setStepInstruction(DRILL, "s2", "edited");

    expect(result.steps[1].instruction).toBe("edited");
    expect(result.steps[0].instruction).toBe("one");
  });
});

describe("setStepPosition", () => {
  test("moves a marker on one step only", () => {
    const result = setStepPosition(DRILL, "s1", "a", { x: 0.9, y: 0.9 });

    expect(result.steps[0].positions.a).toEqual({ x: 0.9, y: 0.9 });
    expect(result.steps[1].positions.a).toEqual({ x: 0.2, y: 0.2 });
  });
});

describe("addMarker", () => {
  test("adds a labelled identity and a bench position on every step", () => {
    const { drill, markerId } = addMarker(DRILL, "middle", 0);

    expect(drill.markers).toHaveLength(3);
    expect(drill.markers.find((m) => m.id === markerId)).toMatchObject({ role: "middle", label: "MB1" });
    for (const step of drill.steps) {
      expect(step.positions[markerId].y).toBeGreaterThan(1); // benched below the end line
    }
  });
});

describe("setMarker", () => {
  test("patches a marker's identity across the drill, leaving positions untouched", () => {
    const result = setMarker(DRILL, "a", { role: "libero", label: "L" });

    expect(result.markers.find((m) => m.id === "a")).toMatchObject({ role: "libero", label: "L" });
    expect(result.steps[0].positions.a).toEqual({ x: 0.2, y: 0.2 });
    expect(DRILL.markers.find((m) => m.id === "a")?.role).toBe("outside");
  });
});

describe("removeMarker", () => {
  test("drops the identity and its position on every step", () => {
    const result = removeMarker(DRILL, "a");

    expect(result.markers.map((m) => m.id)).toEqual(["b"]);
    for (const step of result.steps) {
      expect(step.positions).not.toHaveProperty("a");
      expect(step.positions).toHaveProperty("b");
    }
  });
});
