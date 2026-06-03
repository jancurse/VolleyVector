// What the browse sidebar currently points at: the full grid, or one topic.
export type Selection = { kind: "all" } | { kind: "topic"; id: string };
