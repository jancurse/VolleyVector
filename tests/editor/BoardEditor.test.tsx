import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { createBoard } from "../../src/boards/operations";
import { BoardEditor } from "../../src/editor/BoardEditor";

function setup() {
  const user = userEvent.setup();

  render(<BoardEditor board={createBoard(0)} onDone={vi.fn(async () => null)} onCancel={vi.fn()} />);

  return user;
}

// Marker queries scope to the court, since the inspector can carry the same accessible names.
const court = () => within(screen.getByLabelText("Court editor"));

describe("BoardEditor undo/redo", () => {
  test("undo is disabled until an edit, then Ctrl+Z reverts it", async () => {
    const user = setup();

    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Add setter" }));
    expect(court().getByLabelText("Setter")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();

    await user.keyboard("{Control>}z{/Control}");
    expect(court().queryByLabelText("Setter")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled();

    await user.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    expect(court().getByLabelText("Setter")).toBeInTheDocument();
  });

  test("the undo buttons revert and restore an edit", async () => {
    const user = setup();

    await user.click(screen.getByRole("button", { name: "Add libero" }));
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(court().queryByLabelText("Libero")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Redo" }));
    expect(court().getByLabelText("Libero")).toBeInTheDocument();
  });

  test("Delete removes the selected marker as a recorded edit", async () => {
    const user = setup();

    await user.click(screen.getByRole("button", { name: "Add setter" }));
    await user.keyboard("{Delete}");
    expect(court().queryByLabelText("Setter")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(court().getByLabelText("Setter")).toBeInTheDocument();
  });

  test("tool hotkeys switch the tool and Escape returns to select", async () => {
    const user = setup();

    await user.keyboard("a");
    expect(screen.getByRole("button", { name: "Draw arrow" })).toHaveAttribute("aria-pressed", "true");

    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Select drawing" })).toHaveAttribute("aria-pressed", "true");
  });

  test("tool hotkeys are swallowed while typing in a text field", async () => {
    const user = setup();

    const title = screen.getByRole("textbox", { name: "Board title" });

    await user.click(title);
    await user.keyboard("a");
    expect(title).toHaveValue("Untitled boarda");
    expect(screen.getByRole("button", { name: "Draw arrow" })).toHaveAttribute("aria-pressed", "false");
  });

  test("Ctrl+Z inside a text field is left to the field's native undo", async () => {
    const user = setup();

    await user.click(screen.getByRole("button", { name: "Add setter" }));

    const title = screen.getByRole("textbox", { name: "Board title" });

    await user.click(title);
    await user.keyboard("{Control>}z{/Control}");

    // The app-level undo did not fire: the marker added before is still there.
    expect(court().getByLabelText("Setter")).toBeInTheDocument();
  });
});
