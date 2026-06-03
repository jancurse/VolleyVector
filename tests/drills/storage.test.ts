import { afterEach, describe, expect, test } from "vitest";

import { loadDrills, SAMPLE_DRILL, saveDrills } from "../../src/drills/storage";

afterEach(() => localStorage.clear());

describe("drills storage", () => {
  test("returns null before anything is saved", () => {
    expect(loadDrills()).toBeNull();
  });

  test.each([
    ["a saved collection", [SAMPLE_DRILL]],
    ["an explicitly emptied collection", []],
  ])("round-trips %s", (_label, drills) => {
    saveDrills(drills);
    expect(loadDrills()).toEqual(drills);
  });

  test.each([
    ["malformed json", "not json"],
    ["a non-array", JSON.stringify({ not: "an array" })],
    ["items missing required fields", JSON.stringify([{ id: 1 }])],
  ])("returns null for %s", (_label, raw) => {
    localStorage.setItem("volleycoach-drills", raw);
    expect(loadDrills()).toBeNull();
  });
});
