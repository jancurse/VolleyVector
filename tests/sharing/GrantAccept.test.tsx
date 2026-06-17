import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { GrantAccept } from "../../src/sharing/GrantAccept";
import { recordedRpcs, resetRecorded, setGrantTarget } from "../helpers/supabaseFake";

// Mock only the external Supabase client; the real component runs against it.
vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

beforeEach(() => resetRecorded());
afterEach(() => vi.clearAllMocks());

test("a grant link previews its content and redeems it on accept", async () => {
  const user = userEvent.setup();
  // Accepting reloads at the root; stub the navigation so the test environment is not asked to navigate.
  const replace = vi.spyOn(window.location, "replace").mockImplementation(() => {});

  render(<GrantAccept token="grant-token" />);

  expect(await screen.findByText(/edit the board “Shared Tactic”/i)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Accept" }));

  await vi.waitFor(() => expect(recordedRpcs.some((c) => c.fn === "redeem_access_link")).toBe(true));
  expect(replace).toHaveBeenCalled();

  replace.mockRestore();
});

test("an invalid link shows the no-longer-valid message and offers no Accept", async () => {
  render(<GrantAccept token="spent-token" />);

  expect(await screen.findByText(/no longer valid/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
});

test("accepting a board grant lands on the board in the personal space", async () => {
  const user = userEvent.setup();
  const replace = vi.spyOn(window.location, "replace").mockImplementation(() => {});

  render(<GrantAccept token="grant-token" />);

  expect(await screen.findByText(/edit the board “Shared Tactic”/i)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Accept" }));

  await vi.waitFor(() =>
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("/personal/board/shared-board-1"))
  );

  replace.mockRestore();
});

test("accepting a note grant lands on the note in the personal space", async () => {
  setGrantTarget("note");
  const user = userEvent.setup();
  const replace = vi.spyOn(window.location, "replace").mockImplementation(() => {});

  render(<GrantAccept token="grant-token" />);

  expect(await screen.findByText(/view the note “Rotations”/i)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Accept" }));

  await vi.waitFor(() => expect(replace).toHaveBeenCalledWith(expect.stringContaining("/personal/note/rotations")));

  replace.mockRestore();
});
