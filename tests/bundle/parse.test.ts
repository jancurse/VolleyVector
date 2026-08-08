import { describe, expect, test } from "vitest";

import { parseBundle } from "../../src/bundle/parse";
import type { Note } from "../../src/notes/types";

// A minimal valid board entry the cases below mutate.
function board(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ref: "b1",
    title: "Board",
    mode: "positions",
    markers: [{ id: "s", role: "setter" }],
    steps: [{ positions: { s: { x: 0.5, y: 0.5 } } }],
    ...patch,
  };
}

function bundle(patch: Record<string, unknown> = {}): string {
  return JSON.stringify({ formatVersion: 4, notes: [], boards: [board()], ...patch });
}

function errorsOf(text: string): string[] {
  const result = parseBundle(text, []);

  return result.ok ? [] : result.errors;
}

describe("parseBundle rejects", () => {
  test.each([
    ["malformed JSON", "{nope", /Not valid JSON/],
    ["a non-object root", "[]", /must be a JSON object/],
    ["a missing formatVersion", JSON.stringify({ notes: [], boards: [] }), /"formatVersion"/],
    ["a newer formatVersion", bundle({ formatVersion: 5 }), /newer than this app supports/],
    ["missing arrays", JSON.stringify({ formatVersion: 4 }), /"notes" must be an array/],
    ["a board without steps", bundle({ boards: [board({ steps: [] })] }), /"steps" must be a non-empty array/],
    ["a board without a mode", bundle({ boards: [board({ mode: "3d" })] }), /"mode" must be/],
    ["an unknown role", bundle({ boards: [board({ markers: [{ id: "s", role: "keeper" }] })] }), /unknown role/],
    [
      "duplicate marker ids",
      bundle({
        boards: [
          board({
            markers: [
              { id: "s", role: "setter" },
              { id: "s", role: "libero" },
            ],
          }),
        ],
      }),
      /duplicate marker id/,
    ],
    [
      "an unknown topicRef in a version-2 bundle",
      JSON.stringify({ formatVersion: 2, topics: [], boards: [board({ topicRef: "missing" })] }),
      /unknown topicRef/,
    ],
    ["an unknown parentRef", bundle({ notes: [{ ref: "t1", title: "T", parentRef: "missing" }] }), /unknown parentRef/],
    [
      "a parent cycle",
      bundle({
        notes: [
          { ref: "t1", title: "A", parentRef: "t2" },
          { ref: "t2", title: "B", parentRef: "t1" },
        ],
      }),
      /form a cycle/,
    ],
    ["a duplicate ref", bundle({ notes: [{ ref: "b1", title: "Clashes with the board" }] }), /Duplicate ref "b1"/],
    [
      "a malformed position",
      bundle({ boards: [board({ steps: [{ positions: { s: { x: "left", y: 0 } } }] })] }),
      /must be an \{ x, y \} point/,
    ],
    [
      "a non-boolean rotationStrict",
      bundle({ boards: [board({ rotationStrict: "yes" })] }),
      /"rotationStrict" must be a boolean/,
    ],
  ])("%s", (_name, text, expected) => {
    expect(errorsOf(text).join("\n")).toMatch(expected);
  });
});

describe("parseBundle leniency", () => {
  test("an older formatVersion imports with an out-of-date notice", () => {
    const result = parseBundle(bundle({ formatVersion: 1 }), []);

    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.value.notices.join("\n")).toMatch(/older format/);
    expect(result.value.boards).toHaveLength(1);
  });

  test("a step missing a marker's position benches it with a notice", () => {
    const text = bundle({
      boards: [
        board({
          markers: [
            { id: "s", role: "setter" },
            { id: "l", role: "libero" },
          ],
        }),
      ],
    });
    const result = parseBundle(text, []);

    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.value.notices.join("\n")).toMatch(/benched/);
    // The bench row sits just below the end line, inside the marker's reach.
    expect(result.value.boards[0].steps[0].positions.l.y).toBeGreaterThan(1);
  });

  test("an off-court coordinate is clamped with a notice", () => {
    const result = parseBundle(bundle({ boards: [board({ steps: [{ positions: { s: { x: 5, y: -5 } } }] })] }), []);

    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.value.notices.join("\n")).toMatch(/clamped/);
    expect(result.value.boards[0].steps[0].positions.s).toEqual({ x: 1.1, y: -0.1 });
  });

  test("a legacy area annotation normalizes and an unreadable one drops with a notice", () => {
    const annotations = [
      { kind: "area", a: { x: 0.1, y: 0.1 }, b: { x: 0.4, y: 0.4 }, color: "red", width: 6 },
      { kind: "splash", color: "red", width: 6 },
    ];
    const result = parseBundle(
      bundle({ boards: [board({ steps: [{ positions: { s: { x: 0.5, y: 0.5 } }, annotations }] })] }),
      []
    );

    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.value.boards[0].steps[0].annotations).toEqual([
      // The retired `red` key resolves to its replacement, `magenta`, rather than dropping.
      expect.objectContaining({ kind: "ellipse", fill: "tint", color: "magenta", width: 6 }),
    ]);
    expect(result.value.notices.join("\n")).toMatch(/dropped an annotation/);
  });

  test("retired marker and annotation colour keys (red/green) load as magenta/teal", () => {
    const result = parseBundle(
      bundle({
        boards: [
          board({
            markers: [{ id: "p", role: "player", color: "red" }],
            steps: [
              {
                positions: { p: { x: 0.5, y: 0.5 } },
                annotations: [{ kind: "line", a: { x: 0.1, y: 0.1 }, b: { x: 0.4, y: 0.4 }, color: "green", width: 6 }],
              },
            ],
          }),
        ],
      }),
      []
    );

    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.value.boards[0].markers[0].color).toBe("magenta");
    expect(result.value.boards[0].steps[0].annotations?.[0].color).toBe("teal");
  });

  test("an unreadable rotation drops with a notice and a custom one keeps only usable entries", () => {
    const steps = [
      { positions: { s: { x: 0.5, y: 0.5 } }, rotation: { kind: "preset", rotation: 9 } },
      {
        positions: { s: { x: 0.5, y: 0.5 } },
        rotation: { kind: "custom", assignment: { 1: "s", 9: "s", 2: "ghost" } },
      },
    ];
    const result = parseBundle(bundle({ boards: [board({ steps })] }), []);

    if (!result.ok) throw new Error(result.errors.join("\n"));

    const [first, second] = result.value.boards[0].steps;

    expect(first.rotation).toBeUndefined();
    expect(second.rotation).toEqual({ kind: "custom", assignment: { 1: "s" } });
    expect(result.value.boards[0].rotationStrict).toBe(false);
    expect(result.value.notices.join("\n")).toMatch(/dropped a rotation/);
    expect(result.value.notices.join("\n")).toMatch(/2 custom rotation entries/);
  });

  test("note slugs and orders mint against the existing tree", () => {
    const existing: Note[] = [
      {
        id: "x",
        title: "Defense",
        slug: "defense",
        blocks: [],
        parentId: null,
        order: 3,
        capability: "owner",
        currentRevisionId: null,
      },
    ];
    const result = parseBundle(
      bundle({
        notes: [
          { ref: "t1", title: "Defense" },
          { ref: "t2", title: "Blocking", parentRef: "t1" },
        ],
        boards: [],
      }),
      existing
    );

    if (!result.ok) throw new Error(result.errors.join("\n"));

    const [parent, child] = result.value.notes;

    expect(parent).toMatchObject({ title: "Defense", slug: "defense-2", parentId: null, order: 4 });
    expect(child).toMatchObject({ title: "Blocking", parentId: parent.id, order: 0 });
  });

  test("a version-2 board's home topic becomes a trailing board link on its note", () => {
    const text = JSON.stringify({
      formatVersion: 2,
      topics: [{ ref: "t1", title: "Defense", blocks: [{ kind: "markdown", text: "Base defence." }] }],
      boards: [board({ topicRef: "t1" })],
    });
    const result = parseBundle(text, []);

    if (!result.ok) throw new Error(result.errors.join("\n"));

    const [note] = result.value.notes;
    const [imported] = result.value.boards;

    expect(note.blocks.map((b) => b.kind)).toEqual(["markdown", "boards"]);
    expect(note.blocks[1]).toMatchObject({ kind: "boards", boardIds: [imported.id] });
  });
});

describe("parseBundle and the opponent side", () => {
  const opponentBoard = (patch: Record<string, unknown> = {}) =>
    bundle({
      boards: [
        board({
          opponentSide: true,
          markers: [
            { id: "s", role: "setter" },
            { id: "x", role: "middle", side: "opponent" },
          ],
          steps: [{ positions: { s: { x: 0.5, y: 0.5 }, x: { x: 0.5, y: -0.5 } } }],
          ...patch,
        }),
      ],
    });

  test("keeps an opponent marker and its far-half position", () => {
    const result = parseBundle(opponentBoard(), []);

    if (!result.ok) throw new Error(result.errors.join("\n"));

    const [b] = result.value.boards;

    expect(b.opponentSide).toBe(true);
    expect(b.markers.map((m) => m.side)).toEqual([undefined, "opponent"]);
    expect(b.steps[0].positions.x).toEqual({ x: 0.5, y: -0.5 });
    expect(result.value.notices).toEqual([]);
  });

  test("without the opponent half, an opponent marker joins our side and its position clamps", () => {
    const result = parseBundle(opponentBoard({ opponentSide: false }), []);

    if (!result.ok) throw new Error(result.errors.join("\n"));

    const [b] = result.value.boards;

    expect(b.markers.every((m) => m.side === undefined)).toBe(true);
    expect(b.steps[0].positions.x.y).toBeCloseTo(-0.1);
    expect(result.value.notices.join("\n")).toMatch(/moved opponent markers to our side/);
  });

  test("rejects a side it cannot read", () => {
    expect(errorsOf(opponentBoard({ markers: [{ id: "s", role: "setter", side: "theirs" }] })).join("\n")).toMatch(
      /"side" must be "opponent"/
    );
  });
});
