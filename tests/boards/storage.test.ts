import { afterEach, describe, expect, test } from "vitest";

import { loadBoards, SAMPLE_BOARDS, saveBoards } from "../../src/boards/storage";

afterEach(() => localStorage.clear());

describe("boards storage", () => {
  test("returns null before anything is saved", () => {
    expect(loadBoards()).toBeNull();
  });

  test.each([
    ["a saved collection", SAMPLE_BOARDS],
    ["an explicitly emptied collection", []],
  ])("round-trips %s", (_label, boards) => {
    saveBoards(boards);
    expect(loadBoards()).toEqual(boards);
  });

  test.each([
    ["malformed json", "not json"],
    ["a non-array", JSON.stringify({ not: "an array" })],
    ["items missing required fields", JSON.stringify([{ id: 1 }])],
  ])("returns null for %s", (_label, raw) => {
    localStorage.setItem("volleycoach-boards", raw);
    expect(loadBoards()).toBeNull();
  });
});
