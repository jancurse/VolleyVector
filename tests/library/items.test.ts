import { describe, expect, test } from "vitest";

import type { Board } from "../../src/boards/types";
import { collectTags, toLibraryItems } from "../../src/library/items";

// A one-step board is a Position (counted by markers); two or more steps is a Sequence (counted by steps).
const position: Board = {
  id: "pos",
  title: "",
  description: "",
  mode: "positions",
  markers: [{ id: "a", role: "setter", label: "S" }],
  steps: [{ id: "s1", instruction: "", positions: { a: { x: 0.5, y: 0.5 } } }],
  tags: ["Defence"],
  topicId: null,
  owner: "",
  authorLocked: false,
  createdAt: 0,
  updatedAt: 100,
};

const sequence: Board = {
  id: "seq",
  title: "Receive",
  description: "",
  mode: "positions",
  markers: [{ id: "b", role: "outside", label: "OH1" }],
  steps: [
    { id: "s1", instruction: "", positions: { b: { x: 0.2, y: 0.3 } } },
    { id: "s2", instruction: "", positions: { b: { x: 0.6, y: 0.3 } } },
  ],
  tags: ["Serve receive", "Defence"],
  topicId: null,
  owner: "",
  authorLocked: false,
  createdAt: 0,
  updatedAt: 200,
};

describe("toLibraryItems", () => {
  test("merges the boards newest first, deriving kind and meta with a falling-back title", () => {
    const items = toLibraryItems([position, sequence]);

    expect(items.map((i) => i.id)).toEqual(["seq", "pos"]); // sequence edited more recently
    expect(items.map((i) => [i.kind, i.title, i.meta])).toEqual([
      ["sequence", "Receive", "2 steps"],
      ["position", "Untitled board", "1 marker"],
    ]);
  });

  test("uses a board's first step for its thumbnail markers", () => {
    const item = toLibraryItems([sequence])[0];

    expect(item.markers).toEqual([{ id: "b", role: "outside", label: "OH1", position: { x: 0.2, y: 0.3 } }]);
  });
});

describe("collectTags", () => {
  test("returns each distinct tag once, alphabetically", () => {
    expect(collectTags(toLibraryItems([position, sequence]))).toEqual(["Defence", "Serve receive"]);
  });
});
