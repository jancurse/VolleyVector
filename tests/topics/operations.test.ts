import { describe, expect, test } from "vitest";

import {
  childrenOf,
  createTopic,
  deleteTopic,
  flattenTopics,
  moveTopic,
  nestTopic,
  setTopic,
  subtreeIds,
} from "../../src/topics/operations";
import type { Topic } from "../../src/topics/types";

// A small tree: two roots (A before B); A has children A1, A2; A1 has a grandchild A1a.
const TREE: Topic[] = [
  { id: "A", title: "A", body: "", parentId: null, order: 0 },
  { id: "B", title: "B", body: "", parentId: null, order: 1 },
  { id: "A1", title: "A1", body: "", parentId: "A", order: 0 },
  { id: "A2", title: "A2", body: "", parentId: "A", order: 1 },
  { id: "A1a", title: "A1a", body: "", parentId: "A1", order: 0 },
];

describe("childrenOf", () => {
  test("returns direct children in order; null gives the roots", () => {
    expect(childrenOf(TREE, "A").map((t) => t.id)).toEqual(["A1", "A2"]);
    expect(childrenOf(TREE, null).map((t) => t.id)).toEqual(["A", "B"]);
  });
});

describe("subtreeIds", () => {
  test("collects a topic and all its descendants", () => {
    expect(new Set(subtreeIds(TREE, "A"))).toEqual(new Set(["A", "A1", "A2", "A1a"]));
    expect(subtreeIds(TREE, "B")).toEqual(["B"]);
  });
});

describe("flattenTopics", () => {
  test("walks depth-first, tagging each topic with its depth", () => {
    expect(flattenTopics(TREE).map(({ topic, depth }) => [topic.id, depth])).toEqual([
      ["A", 0],
      ["A1", 1],
      ["A1a", 2],
      ["A2", 1],
      ["B", 0],
    ]);
  });
});

describe("createTopic", () => {
  test("appends a new topic after its siblings and returns its id", () => {
    const { topics, id } = createTopic(TREE, "A", "A3");
    const created = topics.find((t) => t.id === id);

    expect(created).toMatchObject({ title: "A3", parentId: "A", body: "" });
    expect(childrenOf(topics, "A").map((t) => t.id)).toEqual(["A1", "A2", id]); // last among A's children
  });
});

describe("setTopic", () => {
  test("patches a topic's title and body, leaving the rest", () => {
    const result = setTopic(TREE, "A1", { title: "Renamed", body: "# Hi" });

    expect(result.find((t) => t.id === "A1")).toMatchObject({ title: "Renamed", body: "# Hi", parentId: "A" });
  });
});

describe("deleteTopic", () => {
  test("removes the topic and its whole subtree", () => {
    expect(deleteTopic(TREE, "A").map((t) => t.id)).toEqual(["B"]);
  });
});

describe("nestTopic", () => {
  test("re-parents a topic, appending it under the new parent", () => {
    const result = nestTopic(TREE, "A2", "B");

    expect(result.find((t) => t.id === "A2")).toMatchObject({ parentId: "B", order: 0 });
    expect(childrenOf(result, "A").map((t) => t.id)).toEqual(["A1"]);
  });

  test("refuses to nest a topic under itself or a descendant", () => {
    expect(nestTopic(TREE, "A", "A1a")).toBe(TREE);
    expect(nestTopic(TREE, "A", "A")).toBe(TREE);
  });
});

describe("moveTopic", () => {
  test("swaps a topic with its neighbour, persisting the new order", () => {
    expect(childrenOf(moveTopic(TREE, "A1", 1), "A").map((t) => t.id)).toEqual(["A2", "A1"]);
  });

  test("is a no-op past either end", () => {
    expect(moveTopic(TREE, "A1", -1)).toBe(TREE);
    expect(moveTopic(TREE, "A2", 1)).toBe(TREE);
  });
});
