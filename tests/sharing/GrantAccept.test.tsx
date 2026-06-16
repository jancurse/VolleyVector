import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { GrantAccept } from "../../src/sharing/GrantAccept";
import { recordedRpcs, resetRecorded } from "../helpers/supabaseFake";

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
