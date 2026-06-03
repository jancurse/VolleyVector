import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { App } from "../src/App";

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

// App seeds the sample "Base defence" tactic on first run (cleared localStorage) and opens it in the
// read-only view, so every test starts there.
function renderApp(): UserEvent {
  const user = userEvent.setup();

  render(<App />);

  return user;
}

function openEditor(user: UserEvent): Promise<void> {
  return user.click(screen.getByRole("button", { name: "Edit" }));
}

describe("viewing", () => {
  test("opens read-only with the description rendered and no editor controls", () => {
    renderApp();

    expect(screen.getByText("Perimeter defence")).toBeInTheDocument(); // markdown is rendered, not raw
    expect(screen.queryByRole("button", { name: "Add setter" })).not.toBeInTheDocument();
  });
});

describe("editing markers", () => {
  test("selecting a marker opens the inspector and relabelling updates the court", async () => {
    const user = renderApp();

    await openEditor(user);

    await user.click(screen.getByRole("img", { name: "Setter" }));
    const label = screen.getByLabelText("Label");

    expect(label).toHaveValue("S");

    await user.clear(label);
    await user.type(label, "S2");
    expect(screen.getByText("S2")).toBeInTheDocument();
  });

  test("adding a marker numbers it after its siblings", async () => {
    const user = renderApp();

    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Add middle blocker" }));

    expect(screen.getByRole("img", { name: "Middle blocker 2" })).toBeInTheDocument();
  });

  test("removing the selected marker takes it off the court", async () => {
    const user = renderApp();

    await openEditor(user);

    await user.click(screen.getByRole("img", { name: "Setter" }));
    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.queryByRole("img", { name: "Setter" })).not.toBeInTheDocument();
  });

  test("recolouring a marker changes its role", async () => {
    const user = renderApp();

    await openEditor(user);

    await user.click(screen.getByRole("img", { name: "Outside hitter 1" }));
    await user.click(screen.getByRole("button", { name: "Libero" }));

    expect(screen.getByRole("img", { name: "Libero 1" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Outside hitter 1" })).not.toBeInTheDocument();
  });
});

describe("court mode", () => {
  test("switching to basic mode swaps the palette to generic roles", async () => {
    const user = renderApp();

    await openEditor(user);
    expect(screen.getByRole("button", { name: "Add setter" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Basic" }));

    expect(screen.getByRole("button", { name: "Add coach" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add setter" })).not.toBeInTheDocument();
  });

  test("recolours a marker in basic mode, but offers no colours in positions mode", async () => {
    const user = renderApp();

    await openEditor(user);

    await user.click(screen.getByRole("img", { name: "Setter" }));
    expect(screen.queryByRole("group", { name: "Colour" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Basic" }));
    await user.click(screen.getByRole("button", { name: "Add player" }));
    expect(screen.getByRole("button", { name: "Blue", pressed: true })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Red" }));
    expect(screen.getByRole("button", { name: "Red", pressed: true })).toBeInTheDocument();
  });
});

describe("description", () => {
  test("write/preview renders the markdown while editing", async () => {
    const user = renderApp();

    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.getByText("Perimeter defence")).toBeInTheDocument();
  });
});

describe("the view/edit flow", () => {
  test("Done commits edits back to the view", async () => {
    const user = renderApp();

    await openEditor(user);

    const title = screen.getByLabelText("Tactic title");

    await user.clear(title);
    await user.type(title, "Press defence");
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByRole("heading", { name: "Press defence" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
  });

  test("Cancel discards edits", async () => {
    const user = renderApp();

    await openEditor(user);

    const title = screen.getByLabelText("Tactic title");

    await user.clear(title);
    await user.type(title, "Throwaway");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Throwaway")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Base defence" })).toBeInTheDocument();
  });

  test("creating a tactic opens a fresh editor and commits on Done", async () => {
    const user = renderApp();

    await user.click(screen.getByRole("button", { name: "+ New" }));
    const title = screen.getByLabelText("Tactic title");

    expect(title).toHaveValue("Untitled tactic");
    expect(screen.queryByRole("img", { name: "Setter" })).not.toBeInTheDocument();

    await user.clear(title);
    await user.type(title, "New press");
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByRole("button", { name: /New press/ })).toBeInTheDocument();
  });

  test("deleting removes the tactic", async () => {
    vi.stubGlobal("confirm", () => true);
    const user = renderApp();

    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText("No tactics yet.")).toBeInTheDocument();
  });
});
