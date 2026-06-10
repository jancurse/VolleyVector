import { describe, expect, test } from "vitest";

import { ATTACK_LINE } from "../../src/court/geometry";
import { snapAnnotationPoint } from "../../src/court/snapping";

const NO_MARKERS: { x: number; y: number }[] = [];

describe("snapAnnotationPoint", () => {
  test.each([
    ["left sideline", { x: 0.012, y: 0.4 }, { x: 0, y: 0.4 }],
    ["centre line", { x: 0.51, y: 0.4 }, { x: 0.5, y: 0.4 }],
    ["right sideline", { x: 0.992, y: 0.4 }, { x: 1, y: 0.4 }],
    ["net", { x: 0.4, y: 0.015 }, { x: 0.4, y: 0 }],
    ["attack line", { x: 0.4, y: ATTACK_LINE + 0.01 }, { x: 0.4, y: ATTACK_LINE }],
    ["end line", { x: 0.4, y: 0.99 }, { x: 0.4, y: 1 }],
  ])("snaps to the %s and reports the target", (_name, point, snapped) => {
    const result = snapAnnotationPoint(point, NO_MARKERS, 0);

    expect(result.point.x).toBeCloseTo(snapped.x);
    expect(result.point.y).toBeCloseTo(snapped.y);
    expect(result.target).toEqual(result.point);
  });

  test("a marker centre beats a feature line", () => {
    const marker = { x: 0.505, y: 0.41 };
    const result = snapAnnotationPoint({ x: 0.51, y: 0.4 }, [marker], 0);

    expect(result.point).toEqual(marker);
    expect(result.target).toEqual(marker);
  });

  test("a point just outside the radius does not snap", () => {
    const result = snapAnnotationPoint({ x: 0.525, y: 0.4 }, NO_MARKERS, 0);

    expect(result.point).toEqual({ x: 0.525, y: 0.4 });
    expect(result.target).toBeNull();
  });

  test("a feature snap on one axis still grid-snaps the other", () => {
    // x pulls to the centre line; y sits near the 0.444... line of a 9-division grid.
    const result = snapAnnotationPoint({ x: 0.51, y: 0.45 }, NO_MARKERS, 9);

    expect(result.point.x).toBeCloseTo(0.5);
    expect(result.point.y).toBeCloseTo(4 / 9);
  });

  test("away from every feature the grid alone snaps, with no target", () => {
    const result = snapAnnotationPoint({ x: 0.34, y: 0.56 }, NO_MARKERS, 9);

    expect(result.point.x).toBeCloseTo(3 / 9);
    expect(result.point.y).toBeCloseTo(5 / 9);
    expect(result.target).toBeNull();
  });

  test("with the grid off an unsnapped point passes through unchanged", () => {
    const point = { x: 0.34, y: 0.56 };

    expect(snapAnnotationPoint(point, NO_MARKERS, 0)).toEqual({ point, target: null });
  });
});
