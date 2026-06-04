import { afterEach, describe, expect, test } from "vitest";

import { clearBoards, loadBoards, SAMPLE_BOARDS, saveBoards } from "../../src/boards/storage";

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

  test("clearBoards drops the saved boards so the next load reseeds", () => {
    saveBoards(SAMPLE_BOARDS);
    clearBoards();

    expect(loadBoards()).toBeNull();
  });

  test("defaults a board saved before Topics to Unfiled", () => {
    const { topicId: _id, topicOrder: _order, ...legacy } = SAMPLE_BOARDS[0];

    localStorage.setItem("volleycoach-boards", JSON.stringify([legacy]));
    const loaded = loadBoards();

    expect(loaded?.[0]).toMatchObject({ topicId: null, topicOrder: 0 });
  });
});
