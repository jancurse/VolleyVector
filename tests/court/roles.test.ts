import { describe, expect, test } from "vitest";

import { COLOR_KEYS, markerLabel, MARKER_COLORS, resolveColorKey, ROLES } from "../../src/court/roles";
import type { ColorKey, MarkerRole } from "../../src/court/roles";

const ALL_ROLES = Object.keys(ROLES) as MarkerRole[];

describe("markerLabel", () => {
  test("falls back to the role's default code", () => {
    expect(markerLabel("outside")).toBe("OH");
    expect(markerLabel("setter")).toBe("S");
  });

  test("prefers an explicit override", () => {
    expect(markerLabel("outside", "OH2")).toBe("OH2");
  });
});

describe("ROLES", () => {
  test.each(ALL_ROLES)("%s has a name and a colour fill", (role) => {
    expect(ROLES[role].name).not.toHaveLength(0);
    expect(ROLES[role].fill).toMatch(/^(oklch\(|#)/);
    expect(ROLES[role].ring).toMatch(/^(oklch\(|#)/);
  });

  test("the ball has no default code", () => {
    expect(ROLES.ball.code).toBe("");
  });
});

describe("MARKER_COLORS", () => {
  test("the colour-key set is the colour-blind-safe palette with no red/green pair", () => {
    expect(COLOR_KEYS).toEqual(["blue", "amber", "teal", "magenta", "violet", "slate"]);
    expect(Object.keys(MARKER_COLORS).sort()).toEqual([...COLOR_KEYS].sort());
  });

  test("the two leading swatches are the most-distinct pair (blue, then amber)", () => {
    expect(COLOR_KEYS.slice(0, 2)).toEqual(["blue", "amber"]);
  });

  // The reset-to-role contract: the inspector matches a marker's fill against MARKER_COLORS to find its
  // swatch, so a recoloured marker resets to its role default only while these stay exactly equal.
  test("blue and slate match the player and coach role fills", () => {
    expect(MARKER_COLORS.blue.fill).toBe(ROLES.player.fill);
    expect(MARKER_COLORS.blue.ring).toBe(ROLES.player.ring);
    expect(MARKER_COLORS.slate.fill).toBe(ROLES.coach.fill);
    expect(MARKER_COLORS.slate.ring).toBe(ROLES.coach.ring);
  });
});

describe("resolveColorKey", () => {
  test("maps the retired keys to their replacements", () => {
    expect(resolveColorKey("red")).toBe("magenta");
    expect(resolveColorKey("green")).toBe("teal");
  });

  test.each(COLOR_KEYS)("passes a current key through unchanged: %s", (key: ColorKey) => {
    expect(resolveColorKey(key)).toBe(key);
  });

  test("returns null for an unknown key", () => {
    expect(resolveColorKey("chartreuse")).toBeNull();
  });
});
