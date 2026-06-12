import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { Board } from "../../src/boards/types";
import { TopicPrint } from "../../src/print/TopicPrint";
import type { Topic } from "../../src/topics/types";

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
    owner: null,
    authorLocked: false,
    shared: false,
    teamId: null,
    autoArrows: true,
    rotationStrict: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("TopicPrint", () => {
  test("prints the title, prose, placed boards once, and unplaced members trailing", () => {
    const topic: Topic = {
      id: "t",
      title: "Serve receive",
      slug: "serve-receive",
      parentId: null,
      order: 0,
      blocks: [
        { id: "md", kind: "markdown", text: "Read the server" },
        { id: "g1", kind: "boards", boardIds: ["b1", "b1", "gone"] },
      ],
    };

    render(<TopicPrint topic={topic} boards={[board("b1", "Rotation 1"), board("b2", "Rotation 2")]} />);

    expect(screen.getByRole("heading", { name: "Serve receive", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Read the server")).toBeInTheDocument();
    // The placed board prints once despite the duplicate hint; the unfiled hint is dropped; the
    // unplaced member trails.
    expect(screen.getAllByRole("heading", { name: "Rotation 1", level: 2 })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Rotation 2", level: 2 })).toBeInTheDocument();
  });
});
