import { afterEach, describe, expect, test } from "vitest";

import { clearTopics, loadTopics, SAMPLE_TOPICS, saveTopics } from "../../src/topics/storage";
import type { Topic } from "../../src/topics/types";

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

  test("accepts a topic whose blocks interleave markdown and board groups", () => {
    const topic: Topic = {
      id: "t",
      title: "T",
      slug: "t",
      blocks: [
        { id: "m", kind: "markdown", text: "hi" },
        { id: "g", kind: "boards", boardIds: ["b1", "b2"] },
      ],
      parentId: null,
      order: 0,
    };

    saveTopics([topic]);
    expect(loadTopics()).toEqual([topic]);
  });

  const topicWith = (blocks: unknown) =>
    JSON.stringify([{ id: "t", title: "T", slug: "t", blocks, parentId: null, order: 0 }]);

  test.each([
    ["malformed json", "not json"],
    ["a non-array", JSON.stringify({ not: "an array" })],
    ["items missing required fields", JSON.stringify([{ id: "x" }])],
    ["non-array blocks", topicWith("nope")],
    ["a block of unknown kind", topicWith([{ id: "b", kind: "video" }])],
    ["a markdown block with non-string text", topicWith([{ id: "b", kind: "markdown", text: 1 }])],
    ["a boards block with a non-string[] boardIds", topicWith([{ id: "b", kind: "boards", boardIds: [1, 2] }])],
  ])("returns null for %s", (_label, raw) => {
    localStorage.setItem("volleycoach-topics", raw);
    expect(loadTopics()).toBeNull();
  });

  test("clearTopics drops the saved topics so the next load reseeds", () => {
    saveTopics(SAMPLE_TOPICS);
    clearTopics();

    expect(loadTopics()).toBeNull();
  });
});
