import { describe, expect, test } from "vitest";

import { normalizeAnnotation, normalizeMarkers, normalizeSteps } from "../../src/boards/normalize";
import type { StoredAnnotation } from "../../src/boards/normalize";
import type { BoardMarker } from "../../src/boards/types";
import type { Annotation } from "../../src/boards/types";

const A = { x: 0.2, y: 0.2 };
const B = { x: 0.6, y: 0.5 };
const STYLE = { color: "magenta", width: 8 } as const;

describe("normalizeAnnotation", () => {
  test("a legacy area becomes a tinted ellipse", () => {
    const stored: StoredAnnotation = { id: "z", kind: "area", a: A, b: B, ...STYLE };

    expect(normalizeAnnotation(stored)).toEqual({ id: "z", kind: "ellipse", a: A, b: B, fill: "tint", ...STYLE });
  });

  test("a rect predating fills gets fill none", () => {
    const stored: StoredAnnotation = { id: "r", kind: "rect", a: A, b: B, ...STYLE };

    expect(normalizeAnnotation(stored)).toEqual({ id: "r", kind: "rect", a: A, b: B, fill: "none", ...STYLE });
  });

  test.each<Annotation>([
    { id: "r", kind: "rect", a: A, b: B, fill: "hachure", ...STYLE },
    { id: "e", kind: "ellipse", a: A, b: B, fill: "tint", ...STYLE },
    { id: "p", kind: "polygon", points: [A, B, { x: 0.4, y: 0.8 }], fill: "none", ...STYLE },
    { id: "l", kind: "line", a: A, b: B, ...STYLE },
    { id: "f", kind: "free", points: [A, B], ...STYLE },
  ])("a modern $kind passes through untouched", (annotation) => {
    expect(normalizeAnnotation(annotation)).toEqual(annotation);
  });

  test("a retired colour key resolves to its replacement", () => {
    // Stored content predating the colour-blind retune may carry the dropped red/green keys.
    const legacy = (color: string) =>
      ({ id: "l", kind: "line", a: A, b: B, color, width: 8 }) as unknown as StoredAnnotation;

    expect(normalizeAnnotation(legacy("red")).color).toBe("magenta");
    expect(normalizeAnnotation(legacy("green")).color).toBe("teal");
  });
});

describe("normalizeMarkers", () => {
  test("remaps a retired colour key and leaves a current one untouched", () => {
    const markers = [
      { id: "a", role: "player", color: "red" },
      { id: "b", role: "player", color: "teal" },
      { id: "c", role: "setter" },
    ] as unknown as BoardMarker[];

    expect(normalizeMarkers(markers)).toEqual([
      { id: "a", role: "player", color: "magenta" },
      { id: "b", role: "player", color: "teal" },
      { id: "c", role: "setter" },
    ]);
  });
});

describe("normalizeSteps", () => {
  test("normalizes each step's annotations and leaves steps without any untouched", () => {
    const steps = normalizeSteps([
      { id: "s1", instruction: "", positions: {} },
      { id: "s2", instruction: "", positions: {}, annotations: [{ id: "z", kind: "area", a: A, b: B, ...STYLE }] },
    ]);

    expect(steps[0]).toEqual({ id: "s1", instruction: "", positions: {} });
    expect(steps[1].annotations).toEqual([{ id: "z", kind: "ellipse", a: A, b: B, fill: "tint", ...STYLE }]);
  });
});
