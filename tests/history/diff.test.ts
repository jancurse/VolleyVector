import { describe, expect, test } from "vitest";

import { changeSummary, diffBoard, diffNote } from "../../src/history/diff";
import { SAMPLE_BOARDS, SAMPLE_NOTES } from "../helpers/sampleData";

const board = SAMPLE_BOARDS[0];
const note = SAMPLE_NOTES[0];

describe("diffBoard", () => {
  test.each([
    ["identical", board, [] as string[]],
    ["title", { ...board, title: "Renamed" }, ["Title"]],
    ["description", { ...board, description: "New" }, ["Description"]],
    ["mode", { ...board, mode: "basic" as const }, ["Mode"]],
    ["tags", { ...board, tags: [...board.tags, "extra"] }, ["Tags"]],
    ["markers", { ...board, markers: board.markers.slice(1) }, ["Markers"]],
    ["steps", { ...board, steps: [...board.steps, { ...board.steps[0], id: "x" }] }, ["Steps"]],
    ["settings", { ...board, autoArrows: !board.autoArrows }, ["Settings"]],
  ])("reports %s", (_label, after, expected) => {
    expect(diffBoard(board, after)).toEqual(expected);
  });

  test("reports several fields in reading order", () => {
    expect(diffBoard(board, { ...board, title: "x", tags: ["y"] })).toEqual(["Title", "Tags"]);
  });
});

describe("diffNote", () => {
  test.each([
    ["identical", note, [] as string[]],
    ["title", { ...note, title: "Renamed" }, ["Title"]],
    ["content", { ...note, blocks: [...note.blocks, { id: "b", kind: "markdown" as const, text: "hi" }] }, ["Content"]],
  ])("reports %s", (_label, after, expected) => {
    expect(diffNote(note, after)).toEqual(expected);
  });
});

describe("changeSummary", () => {
  test("joins labels and names an empty diff", () => {
    expect(changeSummary([])).toBe("No changes");
    expect(changeSummary(["Title", "Steps"])).toBe("Title, Steps");
  });
});
