import { describe, expect, test } from "vitest";

import type { Board } from "../../src/boards/types";
import { parseBundle } from "../../src/bundle/parse";
import { bundleFilename, toBundle } from "../../src/bundle/serialize";
import { SAMPLE_BOARDS, SAMPLE_TOPICS } from "../helpers/sampleData";

describe("toBundle", () => {
  const json = JSON.stringify(toBundle(SAMPLE_BOARDS, SAMPLE_TOPICS));

  test.each(["owner", "teamId", "shared", "authorLocked", "createdAt", "updatedAt", "share_token", "slug"])(
    "carries no server-owned field %s",
    (field) => {
      expect(json).not.toContain(`"${field}"`);
    }
  );

  test("a subtree root's outside parent and a stale board hint are dropped", () => {
    const topic = SAMPLE_TOPICS[0];
    const child = { ...SAMPLE_TOPICS[1], id: "child", parentId: topic.id };
    const bundle = toBundle([], [{ ...child, blocks: [{ id: "b1", kind: "boards", boardIds: ["gone"] }] }]);

    expect(bundle.topics).toEqual([
      { ref: "child", title: child.title, parentRef: null, blocks: [{ kind: "boards", boardRefs: [] }] },
    ]);
  });
});

describe("export → import round-trip", () => {
  const json = JSON.stringify(toBundle(SAMPLE_BOARDS, SAMPLE_TOPICS));
  const result = parseBundle(json, []);

  if (!result.ok) throw new Error(result.errors.join("\n"));

  const { topics, boards, notices } = result.value;

  test("recreates the topics with fresh ids and the same content", () => {
    expect(notices).toEqual([]);
    expect(topics.map((t) => t.title)).toEqual(SAMPLE_TOPICS.map((t) => t.title));
    expect(topics.map((t) => t.blocks.map((b) => (b.kind === "markdown" ? b.text : b.boardIds)))).toEqual(
      SAMPLE_TOPICS.map((t) => t.blocks.map((b) => (b.kind === "markdown" ? b.text : b.boardIds)))
    );
    expect(topics.every((t, i) => t.id !== SAMPLE_TOPICS[i].id)).toBe(true);
  });

  test.each(SAMPLE_BOARDS.map((board, index) => ({ board, index })))(
    "recreates board $board.title with the same content",
    ({ board, index }) => {
      const imported = boards[index];

      expect(imported.id).not.toBe(board.id);
      expect(imported).toMatchObject({
        title: board.title,
        description: board.description,
        mode: board.mode,
        markers: board.markers,
        tags: board.tags,
        autoArrows: board.autoArrows,
      });
      expect(imported.steps.map((s) => s.instruction)).toEqual(board.steps.map((s) => s.instruction));
      expect(imported.steps.map((s) => s.positions)).toEqual(board.steps.map((s) => s.positions));
      // The home topic follows across the id minting: it points at the new topic with the same title.
      const homeTitle = SAMPLE_TOPICS.find((t) => t.id === board.topicId)?.title;

      expect(topics.find((t) => t.id === imported.topicId)?.title).toBe(homeTitle);
    }
  );

  test("imported boards carry no server state", () => {
    expect(boards.every((b) => b.owner === null && b.teamId === null && !b.shared && !b.authorLocked)).toBe(true);
  });

  test("rotations and rotationStrict survive the round-trip", () => {
    const [position] = SAMPLE_BOARDS;
    const withRotations: Board = {
      ...position,
      rotationStrict: true,
      steps: [
        { ...position.steps[0], rotation: { kind: "preset", rotation: 3 } },
        { ...position.steps[0], id: "step-2", rotation: { kind: "custom", assignment: { 1: "s", 4: "oh1" } } },
      ],
    };
    const result = parseBundle(JSON.stringify(toBundle([withRotations], [])), []);

    if (!result.ok) throw new Error(result.errors.join("\n"));

    const imported = result.value.boards[0];

    expect(result.value.notices).toEqual([]);
    expect(imported.rotationStrict).toBe(true);
    expect(imported.steps.map((s) => s.rotation)).toEqual(withRotations.steps.map((s) => s.rotation));
  });
});

describe("bundleFilename", () => {
  test("slugs the title into a .json name", () => {
    expect(bundleFilename("Serve Receive & Sideout")).toBe("serve-receive-sideout.json");
  });
});
