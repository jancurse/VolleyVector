import { describe, expect, test } from "vitest";

import { clamp01, COURT_SPAN, FREE_ZONE, toSvg, toSvgPoint, VIEW_SIZE } from "../../src/court/geometry";

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

test("the viewBox surrounds the playing area with a free zone on every side", () => {
  expect(VIEW_SIZE).toBe(COURT_SPAN + FREE_ZONE * 2);
});
