import { describe, expect, test } from "vitest";

import {
  clamp01,
  clampMarker,
  clampToCourt,
  COURT_SPAN,
  courtViewBox,
  FREE_ZONE,
  fromSvg,
  fromSvgPoint,
  MARKER_REACH,
  snapToGrid,
  toSvg,
  toSvgPoint,
  viewExtent,
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
    // A coarse 3×3 grid would otherwise pull a benched marker (y ≈ 1.07) onto the end line; it stays put.
    [{ x: 0.5, y: 1.07 }, 3, { x: 0.5, y: 1.07 }],
  ])("snaps %o on a %i-grid to %o", (point, divisions, expected) => {
    const result = snapToGrid(point, divisions);

    expect(result.x).toBeCloseTo(expected.x);
    expect(result.y).toBeCloseTo(expected.y);
  });
});

test("the viewBox surrounds the playing area with a free zone on every side", () => {
  expect(VIEW_SIZE).toBe(COURT_SPAN + FREE_ZONE * 2);
});

describe("the opponent half", () => {
  test("clampToCourt reaches past the net to the far end line only when it is on", () => {
    expect(clampToCourt({ x: 0.5, y: -0.6 })).toEqual({ x: 0.5, y: -MARKER_REACH });
    expect(clampToCourt({ x: 0.5, y: -0.6 }, true)).toEqual({ x: 0.5, y: -0.6 });
    expect(clampToCourt({ x: 0.5, y: -3 }, true)).toEqual({ x: 0.5, y: -1 - MARKER_REACH });
    // Our end line and the sidelines are unchanged by it.
    expect(clampToCourt({ x: 2, y: 2 }, true)).toEqual({ x: 1 + MARKER_REACH, y: 1 + MARKER_REACH });
  });

  test("snapToGrid pulls onto the opponent's gridlines only when it is on", () => {
    expect(snapToGrid({ x: 0.5, y: -0.34 }, 3).y).toBeCloseTo(-0.34);
    expect(snapToGrid({ x: 0.5, y: -0.34 }, 3, true).y).toBeCloseTo(-1 / 3);
  });

  describe("clampMarker walls each player into their own half", () => {
    const ours = { role: "setter" as const };
    const theirs = { role: "middle" as const, side: "opponent" as const };
    const ball = { role: "ball" as const };

    test.each([
      ["ours cannot cross to the far half", ours, -0.6, 0],
      ["theirs cannot cross to ours", theirs, 0.6, 0],
      ["ours still reaches its own end line", ours, 1.05, 1.05],
      ["theirs still reaches its own end line", theirs, -1.05, -1.05],
      ["the ball crosses the net freely", ball, -0.6, -0.6],
    ])("%s", (_name, marker, y, expected) => {
      expect(clampMarker({ x: 0.5, y }, true, marker).y).toBeCloseTo(expected);
    });

    test("a half-court board keeps the plain reach, wall and all", () => {
      expect(clampMarker({ x: 0.5, y: -0.6 }, false, ours).y).toBeCloseTo(-MARKER_REACH);
    });
  });

  test("the viewBox opens upward by one half-court, leaving the mapping alone", () => {
    expect(courtViewBox(false)).toBe(`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`);
    expect(courtViewBox(true)).toBe(`0 ${-COURT_SPAN} ${VIEW_SIZE} ${VIEW_SIZE + COURT_SPAN}`);
    expect(viewExtent(true)).toEqual({ width: VIEW_SIZE, height: VIEW_SIZE + COURT_SPAN });
    // The opponent end line lands one free zone below the taller viewBox's top edge.
    expect(toSvg(-1)).toBe(-COURT_SPAN + FREE_ZONE);
  });
});
