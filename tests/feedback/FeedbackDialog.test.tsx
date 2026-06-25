import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { FeedbackDialog } from "../../src/feedback/FeedbackDialog";

// The dialog runs against a mocked Supabase client (the one external dependency): the `submit-feedback`
// Edge Function records its call and returns the success or failure set per test.
type InvokeError = { message: string; context: { json: () => Promise<{ error: string }> } };

let invokeError: InvokeError | null = null;
const invokeCalls: { name: string; body: unknown }[] = [];

vi.mock("../../src/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (name: string, opts: { body: unknown }) => {
        invokeCalls.push({ name, body: opts.body });

        return Promise.resolve(invokeError ? { data: null, error: invokeError } : { data: { ok: true }, error: null });
      },
    },
  },
}));

beforeEach(() => {
  invokeError = null;
  invokeCalls.length = 0;
});

describe("FeedbackDialog", () => {
  test("submits the chosen type and message, then confirms", async () => {
    render(<FeedbackDialog open onOpenChange={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Feature request" }));
    await userEvent.type(screen.getByLabelText("Message"), "An undo button would help");
    await userEvent.click(screen.getByRole("button", { name: "Send report" }));

    expect(invokeCalls).toEqual([
      { name: "submit-feedback", body: { type: "feature", message: "An undo button would help" } },
    ]);
    expect(await screen.findByText(/your report is in/i)).toBeInTheDocument();
  });

  test("defaults to a bug report", async () => {
    render(<FeedbackDialog open onOpenChange={() => {}} />);

    await userEvent.type(screen.getByLabelText("Message"), "The net renders twice");
    await userEvent.click(screen.getByRole("button", { name: "Send report" }));

    expect(invokeCalls[0]?.body).toEqual({ type: "bug", message: "The net renders twice" });
  });

  test("surfaces the returned error on failure", async () => {
    invokeError = { message: "x", context: { json: () => Promise.resolve({ error: "Server says no" }) } };
    render(<FeedbackDialog open onOpenChange={() => {}} />);

    const dialog = screen.getByRole("dialog");

    await userEvent.type(within(dialog).getByLabelText("Message"), "Something broke");
    await userEvent.click(within(dialog).getByRole("button", { name: "Send report" }));

    expect(await screen.findByText("Server says no")).toBeInTheDocument();
    expect(within(dialog).queryByText(/your report is in/i)).not.toBeInTheDocument();
  });
});
