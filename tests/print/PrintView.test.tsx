import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { PrintView } from "../../src/print/PrintView";

describe("PrintView", () => {
  test("forces the light theme and the document title while open, restoring both on leave", () => {
    document.documentElement.dataset.theme = "dark";
    document.title = "VolleyVector";

    const { unmount } = render(
      <PrintView title="Rotation 1" onBack={vi.fn()}>
        <p>Handout</p>
      </PrintView>
    );

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.title).toBe("Rotation 1");
    expect(screen.getByText("Handout")).toBeInTheDocument();

    unmount();
    expect(document.documentElement.dataset.theme).toBe("dark");
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
