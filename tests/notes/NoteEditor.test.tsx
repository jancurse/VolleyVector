import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import type { Board } from "../../src/boards/types";
import { NoteEditor } from "../../src/notes/NoteEditor";
import type { Note, NoteBlock } from "../../src/notes/types";

function board(id: string, title: string): Board {
  return {
    id,
    title,
    description: "",
    mode: "positions",
    markers: [],
    steps: [{ id: "s", instruction: "", positions: {} }],
    tags: [],
    createdBy: null,
    capability: "owner",
    currentRevisionId: null,
    autoArrows: true,
    rotationStrict: false,
    opponentSide: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

function renderEditor(blocks: NoteBlock[], boards: Board[]) {
  const note: Note = {
    id: "t",
    title: "Note",
    slug: "note",
    blocks,
    parentId: null,
    order: 0,
    capability: "owner",
    currentRevisionId: null,
  };
  const onDone = vi.fn<(patch: { title: string; blocks: NoteBlock[] }) => Promise<string | null>>(async () => null);

  render(<NoteEditor note={note} boards={boards} onDone={onDone} onCancel={vi.fn()} />);

  return { user: userEvent.setup(), onDone };
}

const lastBlocks = (onDone: ReturnType<typeof vi.fn>): NoteBlock[] => onDone.mock.calls.at(-1)![0].blocks;

describe("NoteEditor", () => {
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

  test("removes a board from a group, leaving the board itself untouched", async () => {
    const { user, onDone } = renderEditor([{ id: "g", kind: "boards", boardIds: ["b1"] }], [board("b1", "One")]);

    await user.click(screen.getByRole("button", { name: "Remove One from group" }));
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(lastBlocks(onDone)).toEqual([{ id: "g", kind: "boards", boardIds: [] }]);
  });

  test("the picker narrows by the title filter", async () => {
    const { user } = renderEditor(
      [{ id: "g", kind: "boards", boardIds: [] }],
      [board("b1", "One"), board("b2", "Two")]
    );

    await user.type(screen.getByLabelText("Filter boards"), "Two");

    expect(screen.queryByRole("button", { name: "Add One" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Two" })).toBeInTheDocument();
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
    expect(screen.getByLabelText("Note title")).toHaveValue("Note");

    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(onDone).toHaveBeenCalledTimes(2);
  });
});
