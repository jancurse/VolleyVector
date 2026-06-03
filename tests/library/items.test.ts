import { describe, expect, test } from "vitest";

import type { Drill } from "../../src/drills/types";
import { collectTags, toLibraryItems } from "../../src/library/items";
import type { Tactic } from "../../src/tactics/types";

const tactic: Tactic = {
  id: "t1",
  title: "",
  description: "",
  mode: "positions",
  markers: [{ id: "a", role: "setter", position: { x: 0.5, y: 0.5 } }],
  tags: ["Defence"],
  createdAt: 0,
  updatedAt: 100,
};

const drill: Drill = {
  id: "d1",
  title: "Receive",
  description: "",
  mode: "positions",
  markers: [{ id: "b", role: "outside", label: "OH1" }],
  steps: [{ id: "s1", instruction: "", positions: { b: { x: 0.2, y: 0.3 } } }],
  tags: ["Serve receive", "Defence"],
  createdAt: 0,
  updatedAt: 200,
};

describe("toLibraryItems", () => {
  test("merges both content types newest first, with a falling-back title and a count", () => {
    const items = toLibraryItems([tactic], [drill]);

    expect(items.map((i) => i.id)).toEqual(["d1", "t1"]); // drill edited more recently
    expect(items.map((i) => [i.kind, i.title, i.meta])).toEqual([
      ["drill", "Receive", "1 step"],
      ["tactic", "Untitled tactic", "1 marker"],
    ]);
  });

  test("uses a drill's first step for its thumbnail markers", () => {
    const item = toLibraryItems([], [drill])[0];

    expect(item.markers).toEqual([{ id: "b", role: "outside", label: "OH1", position: { x: 0.2, y: 0.3 } }]);
  });
});

describe("collectTags", () => {
  test("returns each distinct tag once, alphabetically", () => {
    expect(collectTags(toLibraryItems([tactic], [drill]))).toEqual(["Defence", "Serve receive"]);
  });
});
