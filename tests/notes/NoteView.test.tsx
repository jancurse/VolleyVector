import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import type { Board } from "../../src/boards/types";
import { NoteView } from "../../src/notes/NoteView";
import type { Note, NoteBlock } from "../../src/notes/types";

function board(id: string, title: string): Board {
  return {
    id,
    title,
    description: "",
    mode: "positions",
    markers: [{ id: "m", role: "setter", label: "S" }],
    steps: [{ id: "s", instruction: "", positions: { m: { x: 0.5, y: 0.5 } } }],
    tags: [],
    createdBy: null,
    capability: "owner",
    currentRevisionId: null,
    autoArrows: true,
    rotationStrict: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

const ONE = board("b1", "Board One");
const TWO = board("b2", "Board Two");

function renderView(blocks: NoteBlock[], boards: Board[]) {
  const note: Note = {
    id: "t",
    title: "Note",
    slug: "note",
    blocks,
    parentId: null,
    order: 0,
    currentRevisionId: null,
  };

  render(
    <NoteView
      note={note}
      notes={[note]}
      boards={boards}
      onOpenBoard={vi.fn()}
      onSelectNote={vi.fn()}
      onEdit={vi.fn()}
      onAddSubnote={vi.fn()}
      onNewBoard={vi.fn()}
      canEdit
    />
  );
}

const heading = (name: string) => screen.queryByRole("heading", { name, level: 3 });

describe("NoteView", () => {
  test("interleaves markdown prose and board groups in block order", () => {
    renderView(
      [
        { id: "md", kind: "markdown", text: "First note" },
        { id: "g", kind: "boards", boardIds: ["b1"] },
      ],
      [ONE]
    );

    const note = screen.getByText("First note");
    const card = heading("Board One")!;

    expect(note).toBeInTheDocument();
    expect(card).toBeInTheDocument();
    expect(note.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("a board group drops an id the space's list does not hold", () => {
    renderView([{ id: "g", kind: "boards", boardIds: ["b2", "b1"] }], [ONE]); // b2 resolves to no board

    expect(heading("Board One")).toBeInTheDocument();
    expect(heading("Board Two")).not.toBeInTheDocument();
  });

  test("a board listed in two groups renders only in the first", () => {
    renderView(
      [
        { id: "g1", kind: "boards", boardIds: ["b1"] },
        { id: "g2", kind: "boards", boardIds: ["b1"] },
      ],
      [ONE]
    );

    expect(screen.getAllByRole("heading", { name: "Board One", level: 3 })).toHaveLength(1);
  });

  test("a board the blocks never reference does not appear", () => {
    renderView([{ id: "g", kind: "boards", boardIds: ["b1"] }], [ONE, TWO]);

    expect(heading("Board One")).toBeInTheDocument(); // referenced by the group
    expect(heading("Board Two")).not.toBeInTheDocument(); // in the library, not in this note
  });

  test("carries no type or tag filter controls", () => {
    renderView([{ id: "g", kind: "boards", boardIds: ["b1"] }], [ONE]);

    expect(screen.queryByRole("group", { name: "Filter by type" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sequences" })).not.toBeInTheDocument();
  });
});
