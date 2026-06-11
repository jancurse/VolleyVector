import { useState } from "react";
import type { JSX } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { TagFilter } from "../../src/library/TagFilter";
import type { TagCount } from "../../src/library/items";

const TAGS: TagCount[] = [
  { tag: "defense", count: 5 },
  { tag: "serve", count: 4 },
  { tag: "attack", count: 3 },
  { tag: "block", count: 2 },
  { tag: "warmup", count: 1 },
];

function Harness({ tags = TAGS }: { tags?: TagCount[] }): JSX.Element {
  const [active, setActive] = useState<string[]>([]);

  return <TagFilter tags={tags} active={active} onChange={setActive} />;
}

describe("TagFilter", () => {
  test("shows quick pills for the most-used tags and the picker for the rest", () => {
    render(<Harness />);

    const pills = within(screen.getByRole("group", { name: "Filter by tag" }));

    expect(pills.queryAllByRole("button").map((b) => b.textContent)).toEqual(["defense", "serve", "attack", "block"]);
    expect(screen.getByRole("button", { name: "All tags" })).toBeInTheDocument();
  });

  test("shows all tags as pills with no picker when few", () => {
    render(<Harness tags={TAGS.slice(0, 3)} />);

    expect(screen.queryByRole("button", { name: "All tags" })).not.toBeInTheDocument();
  });

  test("searches the picker and pins a chosen tag as a pressed quick pill", async () => {
    const user = userEvent.setup();

    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "All tags" }));
    await user.type(screen.getByRole("textbox", { name: "Search tags" }), "war");

    const picker = within(screen.getByRole("group", { name: "All tags" }));

    expect(picker.getAllByRole("button")).toHaveLength(1);
    await user.click(picker.getByRole("button", { name: /warmup/ }));

    const pinned = within(screen.getByRole("group", { name: "Filter by tag" })).getByRole("button", {
      name: "warmup",
    });

    expect(pinned).toHaveAttribute("aria-pressed", "true");
  });

  test("searching an unknown tag shows an empty state", async () => {
    const user = userEvent.setup();

    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "All tags" }));
    await user.type(screen.getByRole("textbox", { name: "Search tags" }), "nope");

    expect(screen.getByText("No matching tags.")).toBeInTheDocument();
  });
});
