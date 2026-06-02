import { describe, expect, test } from "vitest";

import { clamp01 } from "../src/placeholder";

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
