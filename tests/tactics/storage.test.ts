import { afterEach, describe, expect, test } from "vitest";

import { loadTactics, SAMPLE_TACTIC, saveTactics } from "../../src/tactics/storage";

afterEach(() => localStorage.clear());

describe("tactics storage", () => {
  test("returns null before anything is saved", () => {
    expect(loadTactics()).toBeNull();
  });

  test.each([
    ["a saved collection", [SAMPLE_TACTIC]],
    ["an explicitly emptied collection", []],
  ])("round-trips %s", (_label, tactics) => {
    saveTactics(tactics);
    expect(loadTactics()).toEqual(tactics);
  });

  test.each([
    ["malformed json", "not json"],
    ["a non-array", JSON.stringify({ not: "an array" })],
    ["items missing required fields", JSON.stringify([{ id: 1 }])],
  ])("returns null for %s", (_label, raw) => {
    localStorage.setItem("volleycoach-tactics", raw);
    expect(loadTactics()).toBeNull();
  });
});
