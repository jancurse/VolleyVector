// What the browse sidebar currently points at: the full grid, or one note.
export type Selection = { kind: "all" } | { kind: "note"; id: string };
