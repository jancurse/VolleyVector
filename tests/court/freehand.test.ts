import { describe, expect, test } from "vitest";

import { freehandPath, simplifyStroke } from "../../src/court/freehand";
import type { NormalizedPoint } from "../../src/court/geometry";

describe("freehandPath", () => {
  // toSvg maps 0 → 150, 0.25 → 400, 0.5 → 650, so the expected `d` strings are exact.
  test.each([
    [
      "keeps a sharp vertex as a hard corner",
      [
        { x: 0, y: 0 },
        { x: 0.5, y: 0 },
        { x: 0.5, y: 0.5 },
      ],
      "M 150 150 L 650 150 L 650 650",
    ],
    [
      "rounds a gentle vertex through its outgoing midpoint",
      [
        { x: 0, y: 0 },
        { x: 0.25, y: 0.05 },
        { x: 0.5, y: 0 },
      ],
      "M 150 150 Q 400 200 525 175 L 650 150",
    ],
  ] as [string, NormalizedPoint[], string][])("%s", (_name, points, d) => {
    expect(freehandPath(points)).toBe(d);
  });
});

describe("simplifyStroke", () => {
  test("collapses collinear samples to the endpoints", () => {
    const points = Array.from({ length: 50 }, (_, i) => ({ x: i / 49, y: 0.2 }));

    expect(simplifyStroke(points)).toEqual([
      { x: 0, y: 0.2 },
      { x: 1, y: 0.2 },
    ]);
  });

  test("bounds a dense circle to a fraction of its samples", () => {
    const points = Array.from({ length: 200 }, (_, i) => {
      const t = (i / 199) * 2 * Math.PI;

      return { x: 0.5 + 0.3 * Math.cos(t), y: 0.5 + 0.3 * Math.sin(t) };
    });
    const simplified = simplifyStroke(points);

    expect(simplified.length).toBeLessThan(40);
    expect(simplified[0]).toEqual(points[0]);
    expect(simplified[simplified.length - 1]).toEqual(points[199]);
  });

  test("keeps a zigzag's apex exactly", () => {
    const apex = { x: 0.5, y: 0.3 };
    const leg = (from: NormalizedPoint, to: NormalizedPoint): NormalizedPoint[] =>
      Array.from({ length: 50 }, (_, i) => ({
        x: from.x + ((to.x - from.x) * i) / 49,
        y: from.y + ((to.y - from.y) * i) / 49,
      }));

    expect(simplifyStroke([...leg({ x: 0, y: 0 }, apex), ...leg(apex, { x: 1, y: 0 })])).toContainEqual(apex);
  });
});
