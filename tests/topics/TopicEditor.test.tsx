import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import type { Board } from "../../src/boards/types";
import { TopicEditor } from "../../src/topics/TopicEditor";
import type { Topic, TopicBlock } from "../../src/topics/types";

function board(id: string, title: string): Board {
  return {
    id,
    title,
    description: "",
    mode: "positions",
    markers: [],
    steps: [{ id: "s", instruction: "", positions: {} }],
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

function renderEditor(blocks: TopicBlock[], boards: Board[]) {
  const topic: Topic = { id: "t", title: "Topic", slug: "topic", blocks, parentId: null, order: 0 };
  const onDone = vi.fn<(patch: { title: string; blocks: TopicBlock[] }) => Promise<string | null>>(async () => null);
  const onUnfileBoard = vi.fn();

  render(
    <TopicEditor
      topic={topic}
      boards={boards}
      onDone={onDone}
      onCancel={vi.fn()}
      onDelete={vi.fn()}
      onUnfileBoard={onUnfileBoard}
    />
  );

  return { user: userEvent.setup(), onDone, onUnfileBoard };
}

const lastBlocks = (onDone: ReturnType<typeof vi.fn>): TopicBlock[] => onDone.mock.calls.at(-1)![0].blocks;

describe("TopicEditor", () => {
  test("adds a text block, edits it, and commits the blocks on Done", async () => {
    const { user, onDone } = renderEditor([], []);

    await user.click(screen.getByRole("button", { name: "+ Text block" }));
    await user.type(screen.getByPlaceholderText("Write in markdown…"), "Hello");
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(lastBlocks(onDone)).toEqual([{ id: expect.any(String), kind: "markdown", text: "Hello" }]);
  });

  test("adds a board group, assigns and reorders its boards, and commits their order", async () => {
    const { user, onDone } = renderEditor([], [board("b1", "One"), board("b2", "Two")]);

    await user.click(screen.getByRole("button", { name: "+ Board group" }));
    await user.click(screen.getByRole("button", { name: "Add One" }));
    await user.click(screen.getByRole("button", { name: "Add Two" }));
    await user.click(screen.getByRole("button", { name: "Move Two up" })); // [Two, One]
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(lastBlocks(onDone)).toEqual([{ id: expect.any(String), kind: "boards", boardIds: ["b2", "b1"] }]);
  });

  test("removes a board from a group without unfiling it", async () => {
    const { user, onDone, onUnfileBoard } = renderEditor(
      [{ id: "g", kind: "boards", boardIds: ["b1"] }],
      [board("b1", "One")]
    );

    await user.click(screen.getByRole("button", { name: "Remove One from group" }));
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(lastBlocks(onDone)).toEqual([{ id: "g", kind: "boards", boardIds: [] }]);
    expect(onUnfileBoard).not.toHaveBeenCalled();
  });

  test("unfiling a member calls the board store immediately", async () => {
    const { user, onUnfileBoard } = renderEditor([{ id: "g", kind: "boards", boardIds: ["b1"] }], [board("b1", "One")]);

    await user.click(screen.getByRole("button", { name: "Unfile One" }));

    expect(onUnfileBoard).toHaveBeenCalledWith("b1");
  });

  test("reorders and removes blocks, committing the result", async () => {
    const { user, onDone } = renderEditor(
      [
        { id: "a", kind: "markdown", text: "A" },
        { id: "b", kind: "markdown", text: "B" },
      ],
      []
    );

    await user.click(screen.getByRole("button", { name: "Move block 1 down" })); // [B, A]
    await user.click(screen.getByRole("button", { name: "Remove block 2" })); // drop A → [B]
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(lastBlocks(onDone)).toEqual([{ id: "b", kind: "markdown", text: "B" }]);
  });

  test("a failed Done shows the error and keeps the draft on screen for a retry", async () => {
    const { user, onDone } = renderEditor([{ id: "a", kind: "markdown", text: "A" }], []);

    onDone.mockResolvedValueOnce("Load failed");
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Load failed");
    expect(screen.getByLabelText("Topic title")).toHaveValue("Topic");

    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(onDone).toHaveBeenCalledTimes(2);
  });
});
