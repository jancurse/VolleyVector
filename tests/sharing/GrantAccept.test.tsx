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

test("a grant link previews its content, redeems it, then opens it on confirm", async () => {
  const user = userEvent.setup();
  // Opening reloads at the content; stub the navigation so the test environment is not asked to navigate.
  const replace = vi.spyOn(window.location, "replace").mockImplementation(() => {});

  render(<GrantAccept token="grant-token" />);

  expect(await screen.findByText(/edit the board “Shared Tactic”/i)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Accept" }));

  // Redeeming surfaces the resulting capability instead of navigating away silently.
  await vi.waitFor(() => expect(recordedRpcs.some((c) => c.fn === "redeem_access_link")).toBe(true));
  expect(await screen.findByText(/you now have edit access to this board/i)).toBeInTheDocument();
  expect(replace).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Open board" }));
  expect(replace).toHaveBeenCalled();

  replace.mockRestore();
});

test("an invalid link shows the no-longer-valid message and offers no Accept", async () => {
  render(<GrantAccept token="spent-token" />);

  expect(await screen.findByText(/no longer valid/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
});

test("opening a redeemed board grant lands on the board in the personal space", async () => {
  const user = userEvent.setup();
  const replace = vi.spyOn(window.location, "replace").mockImplementation(() => {});

  render(<GrantAccept token="grant-token" />);

  expect(await screen.findByText(/edit the board “Shared Tactic”/i)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Accept" }));
  await user.click(await screen.findByRole("button", { name: "Open board" }));

  await vi.waitFor(() =>
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("/personal/board/shared-board-1"))
  );

  replace.mockRestore();
});

test("opening a redeemed note grant lands on the note in the personal space", async () => {
  setGrantTarget("note");
  const user = userEvent.setup();
  const replace = vi.spyOn(window.location, "replace").mockImplementation(() => {});

  render(<GrantAccept token="grant-token" />);

  expect(await screen.findByText(/view the note “Rotations”/i)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Accept" }));
  await user.click(await screen.findByRole("button", { name: "Open note" }));

  await vi.waitFor(() => expect(replace).toHaveBeenCalledWith(expect.stringContaining("/personal/note/rotations")));

  replace.mockRestore();
});
