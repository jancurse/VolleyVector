import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import type { Board } from "../../src/boards/types";
import { TopicView } from "../../src/topics/TopicView";
import type { Topic, TopicBlock } from "../../src/topics/types";

function board(id: string, title: string): Board {
  return {
    id,
    title,
    description: "",
    mode: "positions",
    markers: [{ id: "m", role: "setter", label: "S" }],
    steps: [{ id: "s", instruction: "", positions: { m: { x: 0.5, y: 0.5 } } }],
    tags: [],
    topicId: "t",
    owner: "",
    authorLocked: false,
    shared: false,
    teamId: null,
    autoArrows: true,
    rotationStrict: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

const ONE = board("b1", "Board One");
const TWO = board("b2", "Board Two");

function renderView(blocks: TopicBlock[], boards: Board[]) {
  const topic: Topic = { id: "t", title: "Topic", slug: "topic", blocks, parentId: null, order: 0 };

  render(
    <TopicView
      topic={topic}
      topics={[topic]}
      boards={boards}
      onOpenBoard={vi.fn()}
      onSelectTopic={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onAddSubtopic={vi.fn()}
      onNewBoard={vi.fn()}
      canEdit
    />
  );
}

const heading = (name: string) => screen.queryByRole("heading", { name, level: 3 });

describe("TopicView", () => {
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

  test("a board group renders only its members, dropping ids filed elsewhere", () => {
    renderView([{ id: "g", kind: "boards", boardIds: ["b2", "b1"] }], [ONE]); // b2 is not a member here

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

  test("members no block placed trail in a final grid", () => {
    renderView([{ id: "g", kind: "boards", boardIds: ["b1"] }], [ONE, TWO]);

    expect(heading("Board One")).toBeInTheDocument(); // placed in the group
    expect(heading("Board Two")).toBeInTheDocument(); // trailing, unplaced
  });

  test("carries no type or tag filter controls", () => {
    renderView([{ id: "g", kind: "boards", boardIds: ["b1"] }], [ONE]);

    expect(screen.queryByRole("group", { name: "Filter by type" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sequences" })).not.toBeInTheDocument();
  });
});
