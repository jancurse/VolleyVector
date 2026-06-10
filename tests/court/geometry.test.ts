import { describe, expect, test } from "vitest";

import {
  clamp01,
  clampToCourt,
  COURT_SPAN,
  FREE_ZONE,
  fromSvg,
  fromSvgPoint,
  MARKER_REACH,
  snapToGrid,
  toSvg,
  toSvgPoint,
  VIEW_SIZE,
} from "../../src/court/geometry";

describe("clamp01", () => {
  test.each([
    [-0.5, 0],
    [0, 0],
    [0.25, 0.25],
    [1, 1],
    [1.5, 1],
  ])("clamps %p to %p", (input, expected) => {
    expect(clamp01(input)).toBe(expected);
  });
});

describe("toSvg", () => {
  test.each([
    [0, FREE_ZONE],
    [0.5, FREE_ZONE + COURT_SPAN / 2],
    [1, FREE_ZONE + COURT_SPAN],
  ])("maps normalized %p to SVG %p", (normalized, expected) => {
    expect(toSvg(normalized)).toBe(expected);
  });
});

describe("toSvgPoint", () => {
  test("maps both axes through toSvg", () => {
    expect(toSvgPoint({ x: 0, y: 1 })).toEqual({ x: toSvg(0), y: toSvg(1) });
  });
});

describe("clampToCourt", () => {
  test.each([
    [
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
    ], // inside the court, untouched
    [
      { x: 0.8, y: -0.085 },
      { x: 0.8, y: -0.085 },
    ], // the ball above the net, within reach
    [
      { x: -1, y: 2 },
      { x: -MARKER_REACH, y: 1 + MARKER_REACH },
    ], // far outside, clamped to the reach
  ])("clamps %o to %o", (input, expected) => {
    expect(clampToCourt(input)).toEqual(expected);
  });
});

describe("fromSvg", () => {
  test.each([0, 0.25, 0.5, 1])("inverts toSvg for %p", (normalized) => {
    expect(fromSvg(toSvg(normalized))).toBeCloseTo(normalized);
  });
});

describe("fromSvgPoint", () => {
  test("inverts toSvgPoint on both axes", () => {
    const result = fromSvgPoint(toSvgPoint({ x: 0.3, y: 0.7 }));

    expect(result.x).toBeCloseTo(0.3);
    expect(result.y).toBeCloseTo(0.7);
  });
});

describe("snapToGrid", () => {
  test.each([
    // A point close to a 3×3 line is pulled onto it (lines at 0, 1/3, 2/3, 1).
    [{ x: 0.35, y: 0.66 }, 3, { x: 1 / 3, y: 2 / 3 }],
    // The middle of a cell stays free, on both axes.
    [{ x: 0.5, y: 0.5 }, 3, { x: 0.5, y: 0.5 }],
    // A 27×27 grid resolves finer: 0.5 sits between lines and stays free, 0.07 pulls to 2/27.
    [{ x: 0.5, y: 0.07 }, 27, { x: 0.5, y: 2 / 27 }],
    // A 9×9 line pulls a nearby axis (0.47 → 4/9), while a y already past the end line stays put.
    [{ x: 0.47, y: 1.08 }, 9, { x: 4 / 9, y: 1.08 }],
  ])("snaps %o on a %i-grid to %o", (point, divisions, expected) => {
    const result = snapToGrid(point, divisions);

    expect(result.x).toBeCloseTo(expected.x);
    expect(result.y).toBeCloseTo(expected.y);
  });
});

test("the viewBox surrounds the playing area with a free zone on every side", () => {
  expect(VIEW_SIZE).toBe(COURT_SPAN + FREE_ZONE * 2);
});
