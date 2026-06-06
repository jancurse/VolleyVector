import { describe, expect, test } from "vitest";

import {
  clamp01,
  clampToCourt,
  COURT_SPAN,
  FREE_ZONE,
  fromSvg,
  fromSvgPoint,
  MARKER_REACH,
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

test("the viewBox surrounds the playing area with a free zone on every side", () => {
  expect(VIEW_SIZE).toBe(COURT_SPAN + FREE_ZONE * 2);
});
