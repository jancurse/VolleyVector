import { describe, expect, test } from "vitest";

import { parseBundle } from "../../src/bundle/parse";
import type { Topic } from "../../src/topics/types";

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
  return JSON.stringify({ formatVersion: 1, topics: [], boards: [board()], ...patch });
}

function errorsOf(text: string): string[] {
  const result = parseBundle(text, []);

  return result.ok ? [] : result.errors;
}

describe("parseBundle rejects", () => {
  test.each([
    ["malformed JSON", "{nope", /Not valid JSON/],
    ["a non-object root", "[]", /must be a JSON object/],
    ["a missing formatVersion", JSON.stringify({ topics: [], boards: [] }), /"formatVersion"/],
    ["a newer formatVersion", bundle({ formatVersion: 2 }), /newer than this app supports/],
    ["missing arrays", JSON.stringify({ formatVersion: 1 }), /"topics" must be an array/],
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
    ["an unknown topicRef", bundle({ boards: [board({ topicRef: "missing" })] }), /unknown topicRef/],
    [
      "an unknown parentRef",
      bundle({ topics: [{ ref: "t1", title: "T", parentRef: "missing" }] }),
      /unknown parentRef/,
    ],
    [
      "a parent cycle",
      bundle({
        topics: [
          { ref: "t1", title: "A", parentRef: "t2" },
          { ref: "t2", title: "B", parentRef: "t1" },
        ],
      }),
      /form a cycle/,
    ],
    ["a duplicate ref", bundle({ topics: [{ ref: "b1", title: "Clashes with the board" }] }), /Duplicate ref "b1"/],
    [
      "a malformed position",
      bundle({ boards: [board({ steps: [{ positions: { s: { x: "left", y: 0 } } }] })] }),
      /must be an \{ x, y \} point/,
    ],
  ])("%s", (_name, text, expected) => {
    expect(errorsOf(text).join("\n")).toMatch(expected);
  });
});

describe("parseBundle leniency", () => {
  test("an older formatVersion imports with an out-of-date notice", () => {
    const result = parseBundle(bundle({ formatVersion: 0 }), []);

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
      expect.objectContaining({ kind: "ellipse", fill: "tint", color: "red", width: 6 }),
    ]);
    expect(result.value.notices.join("\n")).toMatch(/dropped an annotation/);
  });

  test("topic slugs and orders mint against the existing tree", () => {
    const existing: Topic[] = [{ id: "x", title: "Defense", slug: "defense", blocks: [], parentId: null, order: 3 }];
    const result = parseBundle(
      bundle({
        topics: [
          { ref: "t1", title: "Defense" },
          { ref: "t2", title: "Blocking", parentRef: "t1" },
        ],
        boards: [],
      }),
      existing
    );

    if (!result.ok) throw new Error(result.errors.join("\n"));

    const [parent, child] = result.value.topics;

    expect(parent).toMatchObject({ title: "Defense", slug: "defense-2", parentId: null, order: 4 });
    expect(child).toMatchObject({ title: "Blocking", parentId: parent.id, order: 0 });
  });
});
