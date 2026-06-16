import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

import { NoteHistory } from "../../src/history/NoteHistory";
import { resetRecorded } from "../helpers/supabaseFake";
import { SAMPLE_BOARDS, SAMPLE_NOTES } from "../helpers/sampleData";

vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

const note = { ...SAMPLE_NOTES[0], currentRevisionId: `rev-${SAMPLE_NOTES[0].id}` };

beforeEach(resetRecorded);

test("lists note revisions with summaries", async () => {
  render(<NoteHistory note={note} boards={SAMPLE_BOARDS} onBack={() => {}} onOpenBoard={() => {}} />);

  const list = await screen.findByRole("complementary", { name: "Revision history" });

  await waitFor(() => expect(within(list).getByText("Title")).toBeInTheDocument());
  expect(within(list).getByText("Created")).toBeInTheDocument();
});

test("restoring a past revision passes its snapshot up", async () => {
  const onRestore = vi.fn();
  const user = userEvent.setup();

  render(
    <NoteHistory note={note} boards={SAMPLE_BOARDS} onBack={() => {}} onOpenBoard={() => {}} onRestore={onRestore} />
  );

  const list = await screen.findByRole("complementary", { name: "Revision history" });
  const restore = await within(list).findByRole("button", { name: "Restore this version" });

  await user.click(restore);

  expect(onRestore).toHaveBeenCalledTimes(1);
  expect(onRestore.mock.calls[0][0].title).toContain("(draft)");
});
