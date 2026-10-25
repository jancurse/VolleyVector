import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { PrintView } from "../../src/print/PrintView";

describe("PrintView", () => {
  test("pins the light theme on itself and sets the document title while open, restoring it on leave", () => {
    document.documentElement.dataset.theme = "dark";
    document.title = "VolleyVector";

    const { unmount } = render(
      <PrintView title="Rotation 1" onBack={vi.fn()}>
        <p>Handout</p>
      </PrintView>
    );

    expect(screen.getByText("Handout").closest("[data-theme]")).toHaveAttribute("data-theme", "light");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.title).toBe("Rotation 1");

    unmount();
    expect(document.title).toBe("VolleyVector");
  });

  test("the toolbar prints and goes back", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    // happy-dom ships no window.print; stub it as the browser API under test.
    const print = vi.fn();

    vi.stubGlobal("print", print);

    render(
      <PrintView title="Rotation 1" onBack={onBack}>
        <p>Handout</p>
      </PrintView>
    );

    await user.click(screen.getByRole("button", { name: "Print or save as PDF" }));
    expect(print).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "← Back" }));
    expect(onBack).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
