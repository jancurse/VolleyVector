import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { Board } from "../../src/boards/types";
import type { Note } from "../../src/notes/types";
import { NotePrint } from "../../src/print/NotePrint";

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

describe("NotePrint", () => {
  test("prints the title, the prose, and each linked board once", () => {
    const note: Note = {
      id: "t",
      title: "Serve receive",
      slug: "serve-receive",
      parentId: null,
      order: 0,
      currentRevisionId: null,
      blocks: [
        { id: "md", kind: "markdown", text: "Read the server" },
        { id: "g1", kind: "boards", boardIds: ["b1", "b1", "gone"] },
      ],
    };

    render(<NotePrint note={note} boards={[board("b1", "Rotation 1"), board("b2", "Rotation 2")]} />);

    expect(screen.getByRole("heading", { name: "Serve receive", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Read the server")).toBeInTheDocument();
    // The linked board prints once despite the duplicate id; the unresolvable id is dropped; a board
    // no block links does not print.
    expect(screen.getAllByRole("heading", { name: "Rotation 1", level: 2 })).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Rotation 2", level: 2 })).not.toBeInTheDocument();
  });
});
