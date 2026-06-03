import { afterEach, describe, expect, test } from "vitest";

import { loadTopics, SAMPLE_TOPICS, saveTopics } from "../../src/topics/storage";

afterEach(() => localStorage.clear());

describe("topics storage", () => {
  test("returns null before anything is saved", () => {
    expect(loadTopics()).toBeNull();
  });

  test("seeds a non-empty, flat starter tree", () => {
    expect(SAMPLE_TOPICS.length).toBeGreaterThan(0);
    expect(SAMPLE_TOPICS.every((t) => t.parentId === null)).toBe(true);
  });

  test.each([
    ["the seeded tree", SAMPLE_TOPICS],
    ["an explicitly emptied tree", []],
  ])("round-trips %s", (_label, topics) => {
    saveTopics(topics);
    expect(loadTopics()).toEqual(topics);
  });

  test.each([
    ["malformed json", "not json"],
    ["a non-array", JSON.stringify({ not: "an array" })],
    ["items missing required fields", JSON.stringify([{ id: "x" }])],
  ])("returns null for %s", (_label, raw) => {
    localStorage.setItem("volleycoach-topics", raw);
    expect(loadTopics()).toBeNull();
  });
});
