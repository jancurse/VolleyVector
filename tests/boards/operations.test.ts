import { describe, expect, test } from "vitest";

import {
  addAnnotation,
  addMarker,
  annotationHandles,
  copyAnnotationsToNextStep,
  createBoard,
  duplicateAnnotation,
  insertStep,
  makeMarker,
  moveStep,
  nextLabel,
  removeAnnotation,
  removeMarker,
  removeStep,
  reshapeAnnotation,
  setMarker,
  setOpponentSide,
  setStepInstruction,
  setStepPosition,
  stepAnnotations,
  stepMarkers,
  stepMoves,
  translateAnnotation,
  updateAnnotation,
} from "../../src/boards/operations";
import type { Annotation, Board } from "../../src/boards/types";
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
  createdBy: null,
  capability: "owner",
  currentRevisionId: null,
  autoArrows: true,
  rotationStrict: false,
  opponentSide: false,
  createdAt: 0,
  updatedAt: 0,
};

const LINE: Annotation = {
  id: "ann1",
  kind: "line",
  a: { x: 0.1, y: 0.2 },
  b: { x: 0.4, y: 0.5 },
  color: "blue",
  width: 8,
};

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

  test("fills the lowest free index for a role, not one past the count", () => {
    const at = (id: string, label: string): Marker => ({ id, role: "outside", label, position: { x: 0, y: 0 } });

    // OH2 was removed: the next outside reuses index 2 rather than re-minting OH3 (which exists).
    expect(nextLabel("outside", [at("a", "OH1"), at("c", "OH3")])).toBe("OH2");
    // The lowest-numbered was removed: the next outside reclaims OH1.
    expect(nextLabel("outside", [at("b", "OH2")])).toBe("OH1");
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
    expect(board).toMatchObject({ autoArrows: true });
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

  test("benches a marker missing a position for the step instead of yielding undefined", () => {
    const corrupt: Board = {
      ...SEQUENCE,
      steps: [{ id: "s1", instruction: "", positions: { a: { x: 0.2, y: 0.2 } } }], // "b" has no position
    };
    const markers = stepMarkers(corrupt, 0);

    expect(markers.find((m) => m.id === "a")?.position).toEqual({ x: 0.2, y: 0.2 });
    expect(markers.find((m) => m.id === "b")?.position.y).toBeGreaterThan(1); // benched, never undefined
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

describe("stepAnnotations", () => {
  test("defaults to an empty list when a step has no annotations", () => {
    expect(stepAnnotations(SEQUENCE, 0)).toEqual([]);
    expect(stepAnnotations(SEQUENCE, 9)).toEqual([]); // out of range
  });
});

describe("addAnnotation", () => {
  test("adds an annotation to one step only, without mutating the input", () => {
    const result = addAnnotation(SEQUENCE, "s1", LINE);

    expect(stepAnnotations(result, 0)).toEqual([LINE]);
    expect(stepAnnotations(result, 1)).toEqual([]); // the other step is untouched
    expect(SEQUENCE.steps[0].annotations).toBeUndefined(); // input unchanged
  });
});

describe("updateAnnotation", () => {
  test("patches one annotation's style, leaving its geometry and the step's others alone", () => {
    const other: Annotation = { ...LINE, id: "ann2" };
    const board = addAnnotation(addAnnotation(SEQUENCE, "s1", LINE), "s1", other);
    const result = updateAnnotation(board, "s1", "ann1", { color: "magenta", width: 14 });

    expect(stepAnnotations(result, 0)[0]).toMatchObject({ id: "ann1", color: "magenta", width: 14, a: LINE.a });
    expect(stepAnnotations(result, 0)[1]).toEqual(other); // the other annotation is untouched
  });
});

describe("removeAnnotation", () => {
  test("removes one annotation from a step", () => {
    const board = addAnnotation(SEQUENCE, "s1", LINE);

    expect(stepAnnotations(removeAnnotation(board, "s1", "ann1"), 0)).toEqual([]);
  });
});

describe("translateAnnotation", () => {
  test("shifts both corners of a two-corner shape", () => {
    const moved = translateAnnotation(LINE, 0.1, -0.1);

    if (moved.kind !== "line") throw new Error("kind changed");

    expect(moved.a.x).toBeCloseTo(0.2);
    expect(moved.a.y).toBeCloseTo(0.1);
    expect(moved.b.x).toBeCloseTo(0.5);
    expect(moved.b.y).toBeCloseTo(0.4);
  });

  test("shifts an arrow's endpoints, and its via point when bent", () => {
    const arrow: Annotation = {
      id: "a",
      kind: "arrow",
      from: { x: 0.3, y: 0.3 },
      to: { x: 0.6, y: 0.6 },
      via: { x: 0.5, y: 0.2 },
      color: "teal",
      width: 5,
    };
    const moved = translateAnnotation(arrow, -0.1, 0);

    if (moved.kind !== "arrow") throw new Error("kind changed");

    expect(moved.from.x).toBeCloseTo(0.2);
    expect(moved.to.x).toBeCloseTo(0.5);
    expect(moved.via?.x).toBeCloseTo(0.4);
    expect(moved.via?.y).toBeCloseTo(0.2);
  });

  test("shifts every point of a freehand stroke, clamping past the court's reach", () => {
    const free: Annotation = {
      id: "f",
      kind: "free",
      points: [
        { x: 0.2, y: 0.2 },
        { x: 1.05, y: 0.4 },
      ],
      color: "blue",
      width: 8,
    };
    const moved = translateAnnotation(free, 0.2, 0);

    if (moved.kind !== "free") throw new Error("kind changed");

    expect(moved.points[0].x).toBeCloseTo(0.4);
    expect(moved.points[1].x).toBeCloseTo(1.1); // 1.25 clamped to 1 + MARKER_REACH
  });
});

describe("insertStep with annotations", () => {
  test("clones the base step's annotations into the inserted step", () => {
    const board = addAnnotation(SEQUENCE, "s1", LINE);
    const { board: next, stepId } = insertStep(board, 0);
    const inserted = next.steps.find((s) => s.id === stepId);

    expect(inserted?.annotations).toEqual([LINE]);
    expect(inserted?.annotations).not.toBe(board.steps[0].annotations); // a fresh array
    expect(inserted?.annotations?.[0]).not.toBe(LINE); // each shape cloned, not shared
  });
});

const RECT: Annotation = {
  id: "r1",
  kind: "rect",
  a: { x: 0.6, y: 0.7 },
  b: { x: 0.2, y: 0.3 },
  fill: "none",
  color: "magenta",
  width: 8,
};
const POLYGON: Annotation = {
  id: "p1",
  kind: "polygon",
  points: [
    { x: 0.2, y: 0.2 },
    { x: 0.6, y: 0.2 },
    { x: 0.4, y: 0.6 },
  ],
  fill: "tint",
  color: "violet",
  width: 8,
};
const ARROW: Annotation = {
  id: "a1",
  kind: "arrow",
  from: { x: 0.3, y: 0.3 },
  to: { x: 0.6, y: 0.6 },
  color: "teal",
  width: 5,
};
const BENT_ARROW: Annotation = { ...ARROW, via: { x: 0.5, y: 0.2 } };
const FREE: Annotation = {
  id: "f1",
  kind: "free",
  points: [
    { x: 0.1, y: 0.1 },
    { x: 0.2, y: 0.2 },
  ],
  color: "blue",
  width: 8,
};

describe("annotationHandles", () => {
  test.each([
    [LINE, ["start", "end"]],
    [ARROW, ["start", "end", "mid"]],
    [RECT, ["nw", "ne", "se", "sw"]],
    [{ ...RECT, kind: "ellipse" } as Annotation, ["nw", "ne", "se", "sw"]],
    [POLYGON, ["v0", "v1", "v2"]],
    [FREE, []],
  ])("a %o exposes handles %j", (annotation, handles) => {
    expect(annotationHandles(annotation).map((h) => h.handle)).toEqual(handles);
  });

  test("a straight arrow's mid handle sits on its midpoint; a bent arrow's on its via point", () => {
    expect(annotationHandles(ARROW)[2].point).toEqual({ x: expect.closeTo(0.45), y: expect.closeTo(0.45) });
    expect(annotationHandles(BENT_ARROW)[2].point).toEqual({ x: 0.5, y: 0.2 });
  });

  test("a polygon's handles sit on its vertices", () => {
    if (POLYGON.kind !== "polygon") throw new Error("bad fixture");

    expect(annotationHandles(POLYGON).map((h) => h.point)).toEqual(POLYGON.points);
  });

  test("derives box corners whatever the corner order", () => {
    // RECT's a/b are given se-to-nw; the handles still map to compass corners.
    const points = Object.fromEntries(annotationHandles(RECT).map((h) => [h.handle, h.point]));

    expect(points.nw).toEqual({ x: 0.2, y: 0.3 });
    expect(points.se).toEqual({ x: 0.6, y: 0.7 });
  });
});

describe("reshapeAnnotation", () => {
  test.each([
    ["start", { x: 0.05, y: 0.05 }],
    ["end", { x: 0.9, y: 0.9 }],
  ] as const)("moves a line's %s endpoint", (handle, point) => {
    const next = reshapeAnnotation(LINE, handle, point);

    if (next.kind !== "line") throw new Error("kind changed");

    expect(handle === "start" ? next.a : next.b).toEqual(point);
    expect(handle === "start" ? next.b : next.a).toEqual(handle === "start" ? LINE.b : LINE.a);
  });

  test.each([
    ["start", "from"],
    ["end", "to"],
  ] as const)("moves an arrow's %s endpoint", (handle, key) => {
    const next = reshapeAnnotation(ARROW, handle, { x: 0.5, y: 0.1 });

    if (next.kind !== "arrow") throw new Error("kind changed");

    expect(next[key]).toEqual({ x: 0.5, y: 0.1 });
  });

  test.each(["nw", "ne", "se", "sw"] as const)("dragging a box's %s corner anchors the opposite one", (handle) => {
    const next = reshapeAnnotation(RECT, handle, { x: 0.5, y: 0.5 });

    if (next.kind !== "rect") throw new Error("kind changed");

    const before = Object.fromEntries(annotationHandles(RECT).map((h) => [h.handle, h.point]));
    const opposite = { nw: "se", ne: "sw", se: "nw", sw: "ne" }[handle];

    expect(next.a).toEqual({ x: 0.5, y: 0.5 });
    expect(next.b).toEqual(before[opposite]);
  });

  test("clamps the moved point to the court's reach", () => {
    const next = reshapeAnnotation(LINE, "end", { x: 1.5, y: -0.5 });

    if (next.kind !== "line") throw new Error("kind changed");

    expect(next.b).toEqual({ x: 1.1, y: -0.1 });
  });

  test("leaves a freehand stroke unchanged", () => {
    expect(reshapeAnnotation(FREE, "start", { x: 0.5, y: 0.5 })).toBe(FREE);
  });

  test("moves one polygon vertex, leaving the others in place", () => {
    const next = reshapeAnnotation(POLYGON, "v1", { x: 0.9, y: 0.1 });

    if (next.kind !== "polygon") throw new Error("kind changed");

    expect(next.points[1]).toEqual({ x: 0.9, y: 0.1 });
    expect(next.points[0]).toEqual({ x: 0.2, y: 0.2 });
    expect(next.points[2]).toEqual({ x: 0.4, y: 0.6 });
  });

  test.each(["v9", "start"] as const)("ignores the foreign handle %s on a polygon", (handle) => {
    expect(reshapeAnnotation(POLYGON, handle, { x: 0.5, y: 0.5 })).toBe(POLYGON);
  });

  test("dragging an arrow's mid handle bends it through the dragged point", () => {
    const next = reshapeAnnotation(ARROW, "mid", { x: 0.5, y: 0.2 });

    if (next.kind !== "arrow") throw new Error("kind changed");

    expect(next.via).toEqual({ x: 0.5, y: 0.2 });
    expect(next.from).toEqual(ARROW.from);
    expect(next.to).toEqual(ARROW.to);
  });

  test("dragging the mid handle back near the straight line clears the bend", () => {
    // (0.45, 0.46) sits ~0.007 from the from–to diagonal, inside the straighten threshold.
    const next = reshapeAnnotation(BENT_ARROW, "mid", { x: 0.45, y: 0.46 });

    if (next.kind !== "arrow") throw new Error("kind changed");

    expect(next.via).toBeUndefined();
  });

  test("moving a bent arrow's endpoint carries the bend along by half the delta", () => {
    const next = reshapeAnnotation(BENT_ARROW, "end", { x: 0.8, y: 0.6 });

    if (next.kind !== "arrow") throw new Error("kind changed");

    expect(next.to).toEqual({ x: 0.8, y: 0.6 });
    expect(next.via?.x).toBeCloseTo(0.6);
    expect(next.via?.y).toBeCloseTo(0.2);
  });
});

describe("duplicateAnnotation", () => {
  test("returns an offset copy with a fresh id", () => {
    const copy = duplicateAnnotation(LINE);

    if (copy.kind !== "line") throw new Error("kind changed");

    expect(copy.id).not.toBe(LINE.id);
    expect(copy.a.x).toBeCloseTo(0.13);
    expect(copy.a.y).toBeCloseTo(0.23);
  });

  test("offsets every polygon vertex in the copy", () => {
    const copy = duplicateAnnotation(POLYGON);

    if (copy.kind !== "polygon") throw new Error("kind changed");

    expect(copy.id).not.toBe(POLYGON.id);
    expect(copy.points.map((p) => [p.x, p.y])).toEqual([
      [expect.closeTo(0.23), expect.closeTo(0.23)],
      [expect.closeTo(0.63), expect.closeTo(0.23)],
      [expect.closeTo(0.43), expect.closeTo(0.63)],
    ]);
  });

  test("clamps the offset copy to the court's reach", () => {
    const edge: Annotation = { ...LINE, b: { x: 1.1, y: 1.1 } } as Annotation;
    const copy = duplicateAnnotation(edge);

    if (copy.kind !== "line") throw new Error("kind changed");

    expect(copy.b).toEqual({ x: 1.1, y: 1.1 });
  });

  test("offsets a bent arrow's via point with its endpoints", () => {
    const copy = duplicateAnnotation(BENT_ARROW);

    if (copy.kind !== "arrow") throw new Error("kind changed");

    expect(copy.via?.x).toBeCloseTo(0.53);
    expect(copy.via?.y).toBeCloseTo(0.23);
  });
});

describe("copyAnnotationsToNextStep", () => {
  test("appends clones with fresh ids, keeping the next step's own drawings", () => {
    const board = addAnnotation(addAnnotation(SEQUENCE, "s1", LINE), "s2", RECT);
    const next = copyAnnotationsToNextStep(board, 0);
    const target = next.steps[1].annotations ?? [];

    expect(target).toHaveLength(2);
    expect(target[0]).toEqual(RECT); // the existing drawing survives
    expect(target[1]).toMatchObject({ kind: "line", a: LINE.a, b: LINE.b });
    expect(target[1].id).not.toBe(LINE.id);
    expect(next.steps[0].annotations).toEqual([LINE]); // the source step is untouched
  });

  test.each([
    ["the last step", addAnnotation(SEQUENCE, "s2", LINE), 1],
    ["a step with no drawings", SEQUENCE, 0],
  ])("is a no-op on %s", (_name, board, index) => {
    expect(copyAnnotationsToNextStep(board, index)).toBe(board);
  });
});

describe("text annotations", () => {
  const TEXT: Annotation = {
    id: "t1",
    kind: "text",
    at: { x: 0.4, y: 0.6 },
    text: "Serve",
    color: "magenta",
    width: 8,
  };

  test("translates by its anchor and duplicates with a fresh id", () => {
    const moved = translateAnnotation(TEXT, 0.1, -0.1);

    if (moved.kind !== "text") throw new Error("kind changed");

    expect(moved.at.x).toBeCloseTo(0.5);
    expect(moved.at.y).toBeCloseTo(0.5);

    const copy = duplicateAnnotation(TEXT);

    expect(copy.id).not.toBe(TEXT.id);
    expect(copy).toMatchObject({ kind: "text", text: "Serve" });
  });

  test("offers no reshape handles and ignores reshape", () => {
    expect(annotationHandles(TEXT)).toEqual([]);
    expect(reshapeAnnotation(TEXT, "start", { x: 0, y: 0 })).toBe(TEXT);
  });

  test("copies to the next step like any other drawing", () => {
    const next = copyAnnotationsToNextStep(addAnnotation(SEQUENCE, "s1", TEXT), 0);

    expect(next.steps[1].annotations?.[0]).toMatchObject({ kind: "text", text: "Serve" });
  });
});

describe("the opponent side", () => {
  const withOpponents = (): Board => {
    const one = addMarker({ ...createBoard(0), opponentSide: true }, "outside", 0, "opponent");
    const two = addMarker(one.board, "outside", 0, "opponent");

    return addMarker(two.board, "outside", 0).board;
  };

  test("each side benches past its own end line and numbers its labels apart", () => {
    const board = withOpponents();
    const markers = stepMarkers(board, 0);
    const [x1, x2, ours] = markers;

    expect(x1.position.y).toBeLessThan(-1);
    expect(x2.position.y).toBeLessThan(-1);
    expect(x1.position.x).not.toBeCloseTo(x2.position.x); // the second takes the next free slot
    expect(ours.position.y).toBeGreaterThan(1);
    expect([x1.label, ours.label]).toEqual(["OH1", "OH1"]);
    expect(x2.label).toBe("OH2");
  });

  test("hiding the opponent half drops its markers from every step", () => {
    const board = insertStep(withOpponents(), 0).board;
    const hidden = setOpponentSide(board, false);

    expect(hidden.opponentSide).toBe(false);
    expect(hidden.markers.map((m) => m.side)).toEqual([undefined]);
    for (const step of hidden.steps) expect(Object.keys(step.positions)).toHaveLength(1);
  });

  test("hiding it brings one of our own markers back to our half", () => {
    const board = withOpponents();
    const ours = board.markers.find((m) => m.side === undefined)!;
    const reaching = setStepPosition(board, board.steps[0].id, ours.id, { x: 0.5, y: -0.5 });

    expect(setOpponentSide(reaching, false).steps[0].positions[ours.id]).toEqual({ x: 0.5, y: 0 });
  });

  test("showing it pulls one of ours back from over the net, so none is stranded on the far half", () => {
    const { board, markerId } = addMarker(createBoard(0), "outside", 0);
    const reaching = setStepPosition(board, board.steps[0].id, markerId, { x: 0.5, y: -0.08 });

    expect(setOpponentSide(reaching, true).steps[0].positions[markerId]).toEqual({ x: 0.5, y: 0 });
  });
});
