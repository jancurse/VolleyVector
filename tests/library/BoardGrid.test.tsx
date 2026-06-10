import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { BoardGrid } from "../../src/library/BoardGrid";
import type { LibraryItem } from "../../src/library/items";

const item = (kind: LibraryItem["kind"], id: string): LibraryItem => ({
  kind,
  id,
  title: id,
  tags: [],
  markers: [],
  meta: "1 marker",
  updatedAt: 0,
});

const ITEMS = [item("position", "Base defence"), item("sequence", "Serve receive")];

describe("BoardGrid kind pills", () => {
  test("filter exclusively, switch on the other pill, and clear on a second press", async () => {
    const user = userEvent.setup();

    render(<BoardGrid items={ITEMS} onOpen={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Base defence" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sequences" }));
    expect(screen.queryByRole("heading", { name: "Base defence" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Serve receive" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Positions" }));
    expect(screen.getByRole("heading", { name: "Base defence" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Serve receive" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Positions" }));
    expect(screen.getByRole("heading", { name: "Serve receive" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Base defence" })).toBeInTheDocument();
  });
});
