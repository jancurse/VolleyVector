import { describe, expect, test } from "vitest";

import { slugify, uniqueSlug } from "../../src/routing/slug";

describe("slugify", () => {
  test.each([
    ["Serve Receive", "serve-receive"],
    ["Rotation 1 — Base", "rotation-1-base"],
    ["Ångström Über Çedille", "angstrom-uber-cedille"],
    ["  spaced   out  ", "spaced-out"],
    ["Drills/Warm-up #3", "drills-warm-up-3"],
    ["UPPER", "upper"],
  ])("folds %j to %j", (title, slug) => {
    expect(slugify(title)).toBe(slug);
  });

  test.each([
    ["", "untitled"],
    ["---", "untitled"],
    ["💥💥", "untitled"],
  ])("falls back to untitled for %j", (title, slug) => {
    expect(slugify(title)).toBe(slug);
  });
});

describe("uniqueSlug", () => {
  test("returns the base slug when free", () => {
    expect(uniqueSlug("Serve Receive", ["defense"])).toBe("serve-receive");
  });

  test("appends the first free numeric suffix on collision", () => {
    expect(uniqueSlug("Defense", ["defense"])).toBe("defense-2");
    expect(uniqueSlug("Defense", ["defense", "defense-2", "defense-3"])).toBe("defense-4");
  });
});
