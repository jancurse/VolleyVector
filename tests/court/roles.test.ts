import { describe, expect, test } from "vitest";

import { markerLabel, ROLES } from "../../src/court/roles";
import type { MarkerRole } from "../../src/court/roles";

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
  test.each(ALL_ROLES)("%s has a name and a hex fill", (role) => {
    expect(ROLES[role].name).not.toHaveLength(0);
    expect(ROLES[role].fill).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  test("the ball has no default code", () => {
    expect(ROLES.ball.code).toBe("");
  });
});
