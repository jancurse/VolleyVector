import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { Combobox } from "../../src/ui/Combobox";

function renderTags(value: string[] = ["defense", "5-1"]) {
  const onChange = vi.fn();

  render(<Combobox value={value} onChange={onChange} suggestions={["reception"]} />);

  return { user: userEvent.setup(), onChange };
}

describe("Combobox", () => {
  test("arms the ghost chip into an input, commits on Enter, and stays armed for the next tag", async () => {
    const { user, onChange } = renderTags([]);

    await user.click(screen.getByRole("button", { name: "Add tag" }));
    await user.type(screen.getByLabelText("Add tag"), "press{enter}");

    expect(onChange).toHaveBeenCalledWith(["press"]);
    expect(screen.getByLabelText("Add tag")).toHaveFocus(); // still armed
  });

  test("Escape on an empty input disarms back to the ghost chip without touching the tags", async () => {
    const { user, onChange } = renderTags();

    await user.click(screen.getByRole("button", { name: "Add tag" }));
    await user.keyboard("{Escape}");

    expect(onChange).not.toHaveBeenCalled(); // Base UI's Escape must not clear the chips
    expect(await screen.findByRole("button", { name: "Add tag" })).toBeInTheDocument();
    expect(screen.getByText("defense")).toBeInTheDocument();
  });

  test("Escape with typed text only clears the text, keeping the input armed and the tags intact", async () => {
    const { user, onChange } = renderTags();

    await user.click(screen.getByRole("button", { name: "Add tag" }));
    await user.type(screen.getByLabelText("Add tag"), "zz");
    await user.keyboard("{Escape}");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Add tag")).toHaveValue("");
  });

  test("Backspace on an empty input removes the last tag", async () => {
    const { user, onChange } = renderTags();

    await user.click(screen.getByRole("button", { name: "Add tag" }));
    await user.keyboard("{Backspace}");

    expect(onChange).toHaveBeenCalledWith(["defense"]);
  });
});
