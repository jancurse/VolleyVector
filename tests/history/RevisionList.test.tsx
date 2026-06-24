import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, test, vi } from "vitest";

import { RevisionList } from "../../src/history/RevisionList";
import type { RevisionRow } from "../../src/history/RevisionList";

// A current revision (r2) and two past ones (r1, r0), newest first.
const ROWS: RevisionRow[] = [
  { id: "r2", summary: "Title", authorName: "Ada", createdAt: 1_700_000_200_000 },
  { id: "r1", summary: "Markers", authorName: null, createdAt: 1_700_000_100_000 },
  { id: "r0", summary: "Created", authorName: null, createdAt: 1_700_000_000_000 },
];

function renderList(props: Partial<ComponentProps<typeof RevisionList>> = {}): void {
  render(
    <RevisionList
      revisions={ROWS}
      selectedId="r2"
      currentId="r2"
      onSelect={() => {}}
      onRestore={() => {}}
      loading={false}
      error={null}
      {...props}
    />
  );
}

const restoreButtons = () => screen.queryAllByRole("button", { name: "Restore this version" });

test.each([
  { rows: ROWS, count: "3 revisions" },
  { rows: [ROWS[0]], count: "1 revision" },
])("summary names the surface and counts $count", ({ rows, count }) => {
  renderList({ revisions: rows });

  const region = screen.getByRole("complementary", { name: "Revision history" });

  expect(within(region).getByText(count)).toBeInTheDocument();
});

describe.each([
  { when: "the current revision is selected", selectedId: "r2", onRestore: vi.fn() },
  { when: "the viewer cannot edit", selectedId: "r0", onRestore: undefined },
])("hides Restore when $when", ({ selectedId, onRestore }) => {
  test("no restore action is shown", () => {
    renderList({ selectedId, currentId: "r2", onRestore });

    expect(restoreButtons()).toHaveLength(0);
  });
});

test("only the selected past revision offers Restore, bound to that revision", async () => {
  const onRestore = vi.fn();
  const user = userEvent.setup();

  renderList({ selectedId: "r0", currentId: "r2", onRestore });

  const restores = restoreButtons();

  expect(restores).toHaveLength(1);
  expect(screen.getByRole("button", { pressed: true })).toHaveAccessibleName(/Created/);

  await user.click(restores[0]);

  expect(onRestore).toHaveBeenCalledWith("r0");
});
