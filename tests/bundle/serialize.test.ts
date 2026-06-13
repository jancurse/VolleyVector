import { describe, expect, test } from "vitest";

import type { Board } from "../../src/boards/types";
import { parseBundle } from "../../src/bundle/parse";
import { bundleFilename, toBundle } from "../../src/bundle/serialize";
import { SAMPLE_BOARDS, SAMPLE_NOTES } from "../helpers/sampleData";

describe("toBundle", () => {
  const json = JSON.stringify(toBundle(SAMPLE_BOARDS, SAMPLE_NOTES));

  test.each(["owner", "teamId", "shared", "authorLocked", "createdAt", "updatedAt", "share_token", "slug"])(
    "carries no server-owned field %s",
    (field) => {
      expect(json).not.toContain(`"${field}"`);
    }
  );

  test("a subtree root's outside parent and a board ref outside the set are dropped", () => {
    const note = SAMPLE_NOTES[0];
    const child = { ...SAMPLE_NOTES[1], id: "child", parentId: note.id };
    const bundle = toBundle([], [{ ...child, blocks: [{ id: "b1", kind: "boards", boardIds: ["gone"] }] }]);

    expect(bundle.notes).toEqual([
      { ref: "child", title: child.title, parentRef: null, blocks: [{ kind: "boards", boardRefs: [] }] },
    ]);
  });
});

describe("export → import round-trip", () => {
  const json = JSON.stringify(toBundle(SAMPLE_BOARDS, SAMPLE_NOTES));
  const result = parseBundle(json, []);

  if (!result.ok) throw new Error(result.errors.join("\n"));

  const { notes, boards, notices } = result.value;

  test("recreates the notes with fresh ids and the same content", () => {
    expect(notices).toEqual([]);
    expect(notes.map((t) => t.title)).toEqual(SAMPLE_NOTES.map((t) => t.title));
    // Board links follow across the id minting: each boards block resolves to the same board titles.
    const importedTitle = (id: string) => boards.find((b) => b.id === id)?.title;
    const sampleTitle = (id: string) => SAMPLE_BOARDS.find((b) => b.id === id)?.title;

    expect(
      notes.map((t) => t.blocks.map((b) => (b.kind === "markdown" ? b.text : b.boardIds.map(importedTitle))))
    ).toEqual(
      SAMPLE_NOTES.map((t) => t.blocks.map((b) => (b.kind === "markdown" ? b.text : b.boardIds.map(sampleTitle))))
    );
    expect(notes.every((t, i) => t.id !== SAMPLE_NOTES[i].id)).toBe(true);
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
