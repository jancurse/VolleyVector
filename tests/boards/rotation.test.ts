import { describe, expect, test } from "vitest";

import { insertStep } from "../../src/boards/operations";
import {
  OFFICIAL_SPOTS,
  ROTATION_SLOTS,
  clampToLegal,
  placeRotationMarker,
  presetAssignment,
  rotationAssignment,
  rotationLabel,
  rotationViolations,
  setStepRotation,
  violationFlags,
} from "../../src/boards/rotation";
import type { Board, BoardMarker, RotationSlot, StepRotation } from "../../src/boards/types";
import type { NormalizedPoint } from "../../src/court/geometry";
import type { MarkerRole } from "../../src/court/roles";

const m = (id: string, role: MarkerRole, label?: string): BoardMarker => ({ id, role, label });

const FIVE_ONE = [
  m("s", "setter"),
  m("oh1", "outside", "OH1"),
  m("oh2", "outside", "OH2"),
  m("mb1", "middle", "MB1"),
  m("mb2", "middle", "MB2"),
  m("opp", "opposite"),
];

const WITH_LIBERO = [...FIVE_ONE.filter((p) => p.id !== "mb2"), m("lib", "libero")];

/** Each assigned player parked exactly on their official spot — legal by construction. */
function onSpots(assignment: Record<RotationSlot, string>): Record<string, NormalizedPoint> {
  return Object.fromEntries(ROTATION_SLOTS.map((slot) => [assignment[slot], OFFICIAL_SPOTS[slot]]));
}

const ROTATION_1 = presetAssignment(FIVE_ONE, 1)!;

function board(rotation?: StepRotation): Board {
  return {
    id: "b",
    title: "",
    description: "",
    mode: "positions",
    markers: FIVE_ONE,
    steps: [{ id: "s1", instruction: "", positions: onSpots(ROTATION_1), ...(rotation && { rotation }) }],
    tags: [],
    topicId: null,
    owner: "",
    authorLocked: false,
    shared: false,
    teamId: null,
    autoArrows: true,
    rotationStrict: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("presetAssignment", () => {
  test("places the 5-1 service order from the setter's position", () => {
    expect(ROTATION_1).toEqual({ 1: "s", 2: "oh1", 3: "mb1", 4: "opp", 5: "oh2", 6: "mb2" });
    expect(presetAssignment(FIVE_ONE, 4)).toEqual({ 4: "s", 5: "oh1", 6: "mb1", 1: "opp", 2: "oh2", 3: "mb2" });
  });

  test.each<[RotationSlot, RotationSlot, RotationSlot]>([
    // rotation, front-row middle slot, back-row libero slot
    [1, 3, 6],
    [2, 4, 1],
    [5, 4, 1],
  ])("rotation %i puts the middle front (slot %i) and the libero back (slot %i)", (rotation, front, back) => {
    const assignment = presetAssignment(WITH_LIBERO, rotation)!;

    expect(assignment[front]).toBe("mb1");
    expect(assignment[back]).toBe("lib");
  });

  test.each<[string, BoardMarker[]]>([
    ["five players", FIVE_ONE.slice(0, 5)],
    ["seven players", [...FIVE_ONE, m("p7", "player")]],
    ["two setters", [...FIVE_ONE.filter((p) => p.id !== "opp"), m("s2", "setter")]],
    [
      "two liberos",
      [...FIVE_ONE.filter((p) => p.id !== "mb1" && p.id !== "mb2"), m("l1", "libero"), m("l2", "libero")],
    ],
  ])("rejects a roster that is not a 5-1: %s", (_name, markers) => {
    expect(presetAssignment(markers, 1)).toBeNull();
  });
});

describe("rotationAssignment", () => {
  test.each<[string, StepRotation | undefined, BoardMarker[], boolean]>([
    ["off", undefined, FIVE_ONE, false],
    ["a matching preset", { kind: "preset", rotation: 3 }, FIVE_ONE, true],
    ["a preset whose roster broke", { kind: "preset", rotation: 3 }, FIVE_ONE.slice(0, 5), false],
    ["a complete custom assignment", { kind: "custom", assignment: ROTATION_1 }, FIVE_ONE, true],
    ["an unfinished custom assignment", { kind: "custom", assignment: { 1: "s", 2: "oh1" } }, FIVE_ONE, false],
    [
      "a custom assignment with a removed marker",
      { kind: "custom", assignment: ROTATION_1 },
      FIVE_ONE.slice(0, 5),
      false,
    ],
  ])("resolves %s", (_name, rotation, markers, active) => {
    const assignment = rotationAssignment(markers, rotation);

    expect(assignment !== null).toBe(active);
  });
});

describe("rotationViolations", () => {
  test("a legal arrangement, including exact ties, has no violations", () => {
    expect(rotationViolations(ROTATION_1, onSpots(ROTATION_1), FIVE_ONE)).toEqual([]);

    const tied = { ...onSpots(ROTATION_1), s: { x: 0.8, y: OFFICIAL_SPOTS[2].y } }; // level with front counterpart

    expect(rotationViolations(ROTATION_1, tied, FIVE_ONE)).toEqual([]);
  });

  test.each<[string, string, NormalizedPoint, RotationViolationLike]>([
    ["back player nearer the net than the front", "s", { x: 0.8, y: 0.1 }, { kind: "pair", a: 1, b: 2 }],
    ["front pair out of side order", "opp", { x: 0.6, y: 0.22 }, { kind: "pair", a: 4, b: 3 }],
    ["back pair out of side order", "mb2", { x: 0.9, y: 0.72 }, { kind: "pair", a: 6, b: 1 }],
    ["assigned player outside the playing area", "oh1", { x: 1.05, y: 0.22 }, { kind: "outside", slot: 2 }],
  ])("flags %s", (_name, id, position, violation) => {
    const positions = { ...onSpots(ROTATION_1), [id]: position };

    expect(rotationViolations(ROTATION_1, positions, FIVE_ONE)).toEqual([violation]);
  });

  test("flags a libero on a front-row official position", () => {
    const assignment = { ...presetAssignment(WITH_LIBERO, 1)! };

    [assignment[3], assignment[6]] = [assignment[6], assignment[3]]; // libero swapped into the front row

    expect(rotationViolations(assignment, onSpots(assignment), WITH_LIBERO)).toContainEqual({
      kind: "libero",
      slot: 3,
    });
  });
});

type RotationViolationLike = { kind: string; a?: RotationSlot; b?: RotationSlot; slot?: RotationSlot };

describe("clampToLegal", () => {
  const positions = onSpots(ROTATION_1);

  test.each<[string, string, NormalizedPoint, NormalizedPoint]>([
    [
      "holds a back player behind their front counterpart and beside their neighbour",
      "s",
      { x: 0.3, y: 0.1 },
      { x: 0.5, y: 0.22 },
    ],
    ["holds an assigned player inside the playing area", "s", { x: 1.2, y: 0.8 }, { x: 1, y: 0.8 }],
    ["leaves a legal drag untouched", "s", { x: 0.9, y: 0.9 }, { x: 0.9, y: 0.9 }],
  ])("%s", (_name, id, desired, expected) => {
    expect(clampToLegal(ROTATION_1, positions, id, desired)).toEqual(expected);
  });

  test("leaves an unassigned marker untouched", () => {
    expect(clampToLegal(ROTATION_1, positions, "ball", { x: -0.05, y: 1.1 })).toEqual({ x: -0.05, y: 1.1 });
  });
});

describe("violationFlags", () => {
  test("flags both markers of a broken pair with a tie, and a solo violation alone", () => {
    expect(
      violationFlags(ROTATION_1, [
        { kind: "pair", a: 1, b: 2 },
        { kind: "outside", slot: 4 },
      ])
    ).toEqual({ markerIds: ["s", "oh1", "opp"], ties: [{ a: "s", b: "oh1" }] });
  });
});

describe("step rotation edits", () => {
  test("setStepRotation sets and clears one step's rotation", () => {
    const withRotation = setStepRotation(board(), "s1", { kind: "preset", rotation: 2 });

    expect(withRotation.steps[0].rotation).toEqual({ kind: "preset", rotation: 2 });
    expect(setStepRotation(withRotation, "s1", undefined).steps[0].rotation).toBeUndefined();
  });

  test("placeRotationMarker assigns, displaces the previous occupant, and benches", () => {
    const start = board({ kind: "custom", assignment: {} });
    const placed = placeRotationMarker(start, "s1", "s", 1);

    expect(placed.steps[0].rotation).toEqual({ kind: "custom", assignment: { 1: "s" } });

    const displaced = placeRotationMarker(placed, "s1", "oh1", 1);

    expect(displaced.steps[0].rotation).toEqual({ kind: "custom", assignment: { 1: "oh1" } });
    expect(placeRotationMarker(displaced, "s1", "oh1", null).steps[0].rotation).toEqual({
      kind: "custom",
      assignment: {},
    });
  });

  test("insertStep clones the base step's rotation", () => {
    const { board: next } = insertStep(board({ kind: "preset", rotation: 5 }), 0);

    expect(next.steps[1].rotation).toEqual({ kind: "preset", rotation: 5 });
  });
});

describe("rotationLabel", () => {
  test.each<[StepRotation, string]>([
    [{ kind: "preset", rotation: 3 }, "Rotation 3"],
    [{ kind: "custom", assignment: {} }, "Custom rotation"],
  ])("labels %o as %s", (rotation, label) => {
    expect(rotationLabel(rotation)).toBe(label);
  });
});
