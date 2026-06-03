import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { App } from "../src/App";

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

// App seeds the sample "Base defence" Position and "Serve receive to outside" Sequence on first run,
// and opens on the library grid, so every test starts from the cards.
function renderApp(): UserEvent {
  const user = userEvent.setup();

  render(<App />);

  return user;
}

function openPosition(user: UserEvent): Promise<void> {
  return user.click(screen.getByRole("button", { name: /Base defence/ }));
}

function openSequence(user: UserEvent): Promise<void> {
  return user.click(screen.getByRole("button", { name: /Serve receive to outside/ }));
}

function openEditor(user: UserEvent): Promise<void> {
  return user.click(screen.getByRole("button", { name: "Edit" }));
}

describe("library", () => {
  test("lists both kinds as cards", () => {
    renderApp();

    expect(screen.getByRole("button", { name: /Base defence/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Serve receive to outside/ })).toBeInTheDocument();
  });

  test("filtering by type shows only that kind", async () => {
    const user = renderApp();

    await user.click(screen.getByRole("button", { name: "Sequences" }));

    expect(screen.queryByRole("button", { name: /Base defence/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Serve receive to outside/ })).toBeInTheDocument();
  });

  test("filtering by a tag narrows to items carrying it", async () => {
    const user = renderApp();

    await user.click(screen.getByRole("button", { name: "Serve receive" })); // only on the Sequence

    expect(screen.queryByRole("button", { name: /Base defence/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Serve receive to outside/ })).toBeInTheDocument();
  });
});

describe("viewing", () => {
  test("opening a Position shows the read-only view with rendered markdown and no editor controls", async () => {
    const user = renderApp();

    await openPosition(user);

    expect(screen.getByText("Perimeter defence")).toBeInTheDocument(); // markdown is rendered, not raw
    expect(screen.queryByRole("button", { name: "Add setter" })).not.toBeInTheDocument();
  });

  test("the back button returns from a view to the library grid", async () => {
    const user = renderApp();

    await openPosition(user);
    await user.click(screen.getByRole("button", { name: /Library/ }));

    expect(screen.getByRole("button", { name: /Serve receive to outside/ })).toBeInTheDocument();
  });
});

describe("editing markers", () => {
  test("selecting a marker opens the inspector and relabelling updates the court", async () => {
    const user = renderApp();

    await openPosition(user);
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

    await openPosition(user);
    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Add middle blocker" }));

    expect(screen.getByRole("img", { name: "Middle blocker 2" })).toBeInTheDocument();
  });

  test("removing the selected marker takes it off the court", async () => {
    const user = renderApp();

    await openPosition(user);
    await openEditor(user);

    await user.click(screen.getByRole("img", { name: "Setter" }));
    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.queryByRole("img", { name: "Setter" })).not.toBeInTheDocument();
  });

  test("recolouring a marker changes its role", async () => {
    const user = renderApp();

    await openPosition(user);
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

    await openPosition(user);
    await openEditor(user);
    expect(screen.getByRole("button", { name: "Add setter" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Basic" }));

    expect(screen.getByRole("button", { name: "Add coach" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add setter" })).not.toBeInTheDocument();
  });

  test("recolours a marker in basic mode, but offers no colours in positions mode", async () => {
    const user = renderApp();

    await openPosition(user);
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

    await openPosition(user);
    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.getByText("Perimeter defence")).toBeInTheDocument();
  });
});

describe("tags", () => {
  test("a tag added in the editor becomes a library filter", async () => {
    const user = renderApp();

    await openPosition(user);
    await openEditor(user);

    await user.type(screen.getByLabelText("Add tag"), "Press{enter}");
    await user.click(screen.getByRole("button", { name: "Done" }));
    await user.click(screen.getByRole("button", { name: /Library/ }));

    expect(screen.getByRole("button", { name: "Press" })).toBeInTheDocument();
  });

  test("autocomplete offers an existing tag from elsewhere in the library", async () => {
    const user = renderApp();

    await openSequence(user); // the Sequence has no "Defence" tag; the sample Position does
    await openEditor(user);

    await user.type(screen.getByLabelText("Add tag"), "Def");
    await user.click(await screen.findByRole("option", { name: "Defence" }));

    expect(screen.getByRole("button", { name: "Remove Defence" })).toBeInTheDocument();
  });

  test("removing a tag in the editor drops it from the item", async () => {
    const user = renderApp();

    await openPosition(user);
    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Remove Defence" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    await user.click(screen.getByRole("button", { name: /Library/ }));

    expect(screen.queryByRole("button", { name: "Defence" })).not.toBeInTheDocument();
  });
});

describe("the view/edit flow", () => {
  test("Done commits edits back to the view", async () => {
    const user = renderApp();

    await openPosition(user);
    await openEditor(user);

    const title = screen.getByLabelText("Board title");

    await user.clear(title);
    await user.type(title, "Press defence");
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByRole("heading", { name: "Press defence" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
  });

  test("Cancel discards edits", async () => {
    const user = renderApp();

    await openPosition(user);
    await openEditor(user);

    const title = screen.getByLabelText("Board title");

    await user.clear(title);
    await user.type(title, "Throwaway");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Throwaway")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Base defence" })).toBeInTheDocument();
  });

  test("creating a board opens a fresh single-step Position and commits on Done", async () => {
    const user = renderApp();

    await user.click(screen.getByRole("button", { name: "+ New board" }));
    const title = screen.getByLabelText("Board title");

    expect(title).toHaveValue("Untitled board");
    expect(screen.queryByRole("img", { name: "Setter" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Step 1" })).not.toBeInTheDocument(); // a Position has no steps strip

    await user.clear(title);
    await user.type(title, "New press");
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByRole("heading", { name: "New press" })).toBeInTheDocument();
  });

  test("deleting returns to the library without the board", async () => {
    vi.stubGlobal("confirm", () => true);
    const user = renderApp();

    await openPosition(user);
    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.queryByRole("button", { name: /Base defence/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Serve receive to outside/ })).toBeInTheDocument();
  });
});

describe("positions and sequences", () => {
  test("adding a step promotes a Position to a Sequence; removing back to one demotes it", async () => {
    const user = renderApp();

    await user.click(screen.getByRole("button", { name: "+ New board" }));
    expect(screen.queryByRole("button", { name: "Step 1" })).not.toBeInTheDocument(); // a Position

    await user.click(screen.getByRole("button", { name: "Add step" }));
    expect(screen.getByRole("button", { name: "Step 1" })).toBeInTheDocument(); // promoted to a Sequence
    expect(screen.getByRole("button", { name: "Step 2" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove step 2" }));
    expect(screen.queryByRole("button", { name: "Step 2" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Step 1" })).not.toBeInTheDocument(); // demoted to a Position
    expect(screen.getByRole("button", { name: "Add step" })).toBeInTheDocument();
  });

  test("opens the sample Sequence in playback and steps through it", async () => {
    const user = renderApp();

    await openSequence(user);

    expect(screen.getByRole("heading", { name: "Serve receive to outside" })).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByText(/the setter releases to the net/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next step" }));

    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Step 2" })).toHaveAttribute("aria-current", "true");
  });

  test("editing a step's marker identity carries across steps", async () => {
    const user = renderApp();

    await openSequence(user);
    await openEditor(user);

    await user.click(screen.getByRole("img", { name: "Libero" }));
    const label = screen.getByLabelText("Label");

    await user.clear(label);
    await user.type(label, "LB");

    // The relabelled marker is the same identity on every step, so stepping keeps the new label.
    await user.click(screen.getByRole("button", { name: "Step 2" }));
    expect(screen.getByText("LB")).toBeInTheDocument();
  });
});
