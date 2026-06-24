import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

import { BoardHistory } from "../../src/history/BoardHistory";
import { resetRecorded } from "../helpers/supabaseFake";
import { SAMPLE_BOARDS } from "../helpers/sampleData";

vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

// The fake seeds two revisions per sample board: the current `rev-<id>` and an older `rev0-<id>` whose only
// difference is a "(draft)" title.
const board = { ...SAMPLE_BOARDS[0], currentRevisionId: `rev-${SAMPLE_BOARDS[0].id}` };

beforeEach(resetRecorded);

test("lists revisions newest-first with change summaries and marks the current one", async () => {
  render(<BoardHistory board={board} onBack={() => {}} />);

  const list = await screen.findByRole("complementary", { name: "Revision history" });

  await waitFor(() => expect(within(list).getByText("Title")).toBeInTheDocument()); // newest vs its base
  expect(within(list).getByText("Created")).toBeInTheDocument(); // the first revision
  expect(within(list).getByText("Current")).toBeInTheDocument();
});

test("restoring a past revision passes its snapshot up", async () => {
  const onRestore = vi.fn();
  const user = userEvent.setup();

  render(<BoardHistory board={board} onBack={() => {}} onRestore={onRestore} />);

  const list = await screen.findByRole("complementary", { name: "Revision history" });

  // Restore lives inside the selected past row, so the past revision must be picked first.
  await user.click(await within(list).findByRole("button", { name: /Created/ }));
  await user.click(await within(list).findByRole("button", { name: "Restore this version" }));

  expect(onRestore).toHaveBeenCalledTimes(1);
  expect(onRestore.mock.calls[0][0].title).toContain("(draft)");
});

test("without edit rights it offers no restore", async () => {
  render(<BoardHistory board={board} onBack={() => {}} />);

  const list = await screen.findByRole("complementary", { name: "Revision history" });

  await within(list).findByText("Created");
  expect(within(list).queryByRole("button", { name: "Restore this version" })).not.toBeInTheDocument();
});
