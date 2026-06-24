import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Sandbox } from "../../src/landing/Sandbox";
import { recordedInvokes, recordedRpcs, recordedWrites, resetRecorded } from "../helpers/supabaseFake";

// The sandbox builds a board entirely in memory. Mock the Supabase client so that if anything reached for
// it the call would be recorded — the test then asserts the recorded calls stay empty, proving no backend
// read or write occurs.
vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

beforeEach(() => {
  resetRecorded();
  localStorage.clear();
});
afterEach(() => vi.clearAllMocks());

function renderSandbox(onExit = vi.fn()) {
  render(<Sandbox theme="light" onSetTheme={vi.fn()} onExit={onExit} />);

  return onExit;
}

describe("the Try it sandbox", () => {
  test("offers a sample and a blank board as real cards on entry", () => {
    renderSandbox();

    expect(screen.getByRole("heading", { name: "Build a board" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Side-out to the outside/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Untitled board/ })).toBeInTheDocument();
  });

  test("the sample card opens the real board view with JSON and print export actions", async () => {
    const user = userEvent.setup();

    renderSandbox();
    await user.click(screen.getByRole("button", { name: /Side-out to the outside/ }));

    expect(await screen.findByRole("heading", { name: /Side-out to the outside/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Board actions" }));
    const menu = await screen.findByRole("menu");

    expect(within(menu).getByRole("menuitem", { name: "Copy JSON" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Download JSON" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Print…" })).toBeInTheDocument();
  });

  test("the blank card opens a fresh, untitled board", async () => {
    const user = userEvent.setup();

    renderSandbox();
    await user.click(screen.getByRole("button", { name: /Untitled board/ }));

    expect(await screen.findByRole("heading", { name: /Untitled board/ })).toBeInTheDocument();
  });

  test("Edit opens the real board editor, and Done returns to the view", async () => {
    const user = userEvent.setup();

    renderSandbox();
    await user.click(screen.getByRole("button", { name: /Side-out to the outside/ }));
    await user.click(await screen.findByRole("button", { name: "Edit" }));

    expect(await screen.findByRole("button", { name: "Done" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  test("Exit leaves the sandbox", async () => {
    const user = userEvent.setup();
    const onExit = renderSandbox();

    await user.click(screen.getByRole("button", { name: "Exit" }));

    expect(onExit).toHaveBeenCalledOnce();
  });

  test("never reads from or writes to Supabase", async () => {
    const user = userEvent.setup();

    renderSandbox();
    await user.click(screen.getByRole("button", { name: /Side-out to the outside/ }));
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.click(await screen.findByRole("button", { name: "Done" }));

    expect(recordedWrites).toHaveLength(0);
    expect(recordedRpcs).toHaveLength(0);
    expect(recordedInvokes).toHaveLength(0);
  });
});
