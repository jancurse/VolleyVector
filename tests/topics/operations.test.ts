import { describe, expect, test } from "vitest";

import {
  appendBlock,
  childrenOf,
  createTopic,
  deleteTopic,
  flattenTopics,
  makeBoardsBlock,
  makeMarkdownBlock,
  moveBlock,
  moveTopic,
  nestTopic,
  removeBlock,
  setBlockBoards,
  setBlockText,
  setTopic,
  subtreeIds,
} from "../../src/topics/operations";
import type { Topic, TopicBlock } from "../../src/topics/types";

// A small tree: two roots (A before B); A has children A1, A2; A1 has a grandchild A1a.
const TREE: Topic[] = [
  { id: "A", title: "A", slug: "a", blocks: [], parentId: null, order: 0 },
  { id: "B", title: "B", slug: "b", blocks: [], parentId: null, order: 1 },
  { id: "A1", title: "A1", slug: "a1", blocks: [], parentId: "A", order: 0 },
  { id: "A2", title: "A2", slug: "a2", blocks: [], parentId: "A", order: 1 },
  { id: "A1a", title: "A1a", slug: "a1a", blocks: [], parentId: "A1", order: 0 },
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

    expect(created).toMatchObject({ title: "A3", parentId: "A", blocks: [] });
    expect(childrenOf(topics, "A").map((t) => t.id)).toEqual(["A1", "A2", id]); // last among A's children
  });

  test("mints the slug from the title, disambiguating a duplicate with -2", () => {
    const first = createTopic(TREE, null, "Serve Receive");

    expect(first.topics.find((t) => t.id === first.id)?.slug).toBe("serve-receive");

    const second = createTopic(first.topics, null, "Serve Receive");

    expect(second.topics.find((t) => t.id === second.id)?.slug).toBe("serve-receive-2");
  });
});

describe("setTopic", () => {
  test("patches a topic's title and blocks, leaving the rest", () => {
    const blocks = [makeMarkdownBlock("# Hi")];
    const result = setTopic(TREE, "A1", { title: "Renamed", blocks });

    expect(result.find((t) => t.id === "A1")).toMatchObject({ title: "Renamed", blocks, parentId: "A" });
  });
});

// A topic document: a markdown intro, then a board group holding two boards.
const md: TopicBlock = { id: "m", kind: "markdown", text: "intro" };
const grp: TopicBlock = { id: "g", kind: "boards", boardIds: ["b1", "b2"] };
const BLOCKS: TopicBlock[] = [md, grp];

describe("block helpers", () => {
  test("makeMarkdownBlock and makeBoardsBlock build the two block kinds", () => {
    expect(makeMarkdownBlock("hi")).toMatchObject({ kind: "markdown", text: "hi" });
    expect(makeBoardsBlock(["x"])).toMatchObject({ kind: "boards", boardIds: ["x"] });
    expect(makeMarkdownBlock()).toMatchObject({ text: "" });
    expect(makeBoardsBlock()).toMatchObject({ boardIds: [] });
  });

  test("appendBlock adds to the end without mutating the input", () => {
    const added = makeMarkdownBlock("more");

    expect(appendBlock(BLOCKS, added).map((b) => b.id)).toEqual(["m", "g", added.id]);
    expect(BLOCKS).toHaveLength(2);
  });

  test("setBlockText patches a markdown block, ignoring a board group of the same id", () => {
    expect(setBlockText(BLOCKS, "m", "edited").find((b) => b.id === "m")).toMatchObject({ text: "edited" });
    expect(setBlockText(BLOCKS, "g", "edited").find((b) => b.id === "g")).toEqual(grp); // unchanged
  });

  test("setBlockBoards patches a board group, ignoring a markdown block of the same id", () => {
    expect(setBlockBoards(BLOCKS, "g", ["b3"]).find((b) => b.id === "g")).toMatchObject({ boardIds: ["b3"] });
    expect(setBlockBoards(BLOCKS, "m", ["b3"]).find((b) => b.id === "m")).toEqual(md); // unchanged
  });

  test("moveBlock swaps a block with its neighbour, and is a no-op past either end", () => {
    expect(moveBlock(BLOCKS, "m", 1).map((b) => b.id)).toEqual(["g", "m"]);
    expect(moveBlock(BLOCKS, "m", -1).map((b) => b.id)).toEqual(["m", "g"]);
    expect(moveBlock(BLOCKS, "g", 1).map((b) => b.id)).toEqual(["m", "g"]);
  });

  test("removeBlock drops the named block", () => {
    expect(removeBlock(BLOCKS, "m").map((b) => b.id)).toEqual(["g"]);
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
