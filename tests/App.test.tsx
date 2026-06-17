import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { App } from "../src/App";
import { AuthProvider } from "../src/auth/useAuth";
import { FORMAT_VERSION } from "../src/bundle/types";
import { SAMPLE_BOARDS } from "./helpers/sampleData";
import {
  failCommits,
  failWrites,
  resetFakeAuthz,
  resetRecorded,
  setFakeAuthz,
  TEST_USER,
} from "./helpers/supabaseFake";

// Mock only the external Supabase client; the real stores, hooks, and components run against it.
vi.mock("../src/supabase/client", async () => {
  const mod = await import("./helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

beforeEach(() => {
  localStorage.clear();
  resetFakeAuthz();
  resetRecorded();
  window.location.hash = "";
  // The path is the source of truth for navigation now, and one happy-dom window is shared across a
  // file's tests, so reset it so each test starts from the landing route.
  window.history.replaceState(null, "", "/");
});
afterEach(() => vi.unstubAllGlobals());

// App seeds the sample "Sample Position (Base Defence)" Position and "Sample Drill (Serve Receive &
// Sideout)" Sequence on first run, and opens on the library grid, so every test starts from the cards.
async function renderApp(): Promise<UserEvent> {
  const user = userEvent.setup();

  render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );

  // The data layer loads asynchronously, so wait for the seeded library before returning.
  await screen.findByRole("button", { name: /Sample Position/ });

  return user;
}

function openPosition(user: UserEvent): Promise<void> {
  return user.click(screen.getByRole("button", { name: /Sample Position/ }));
}

function openSequence(user: UserEvent): Promise<void> {
  return user.click(screen.getByRole("button", { name: /Sample Drill/ }));
}

function openEditor(user: UserEvent): Promise<void> {
  return user.click(screen.getByRole("button", { name: "Edit" }));
}

describe("library", () => {
  test("lists both kinds as cards", async () => {
    await renderApp();

    expect(screen.getByRole("button", { name: /Sample Position/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sample Drill/ })).toBeInTheDocument();
  });

  test("filtering by type shows only that kind", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "Sequences" }));

    expect(screen.queryByRole("button", { name: /Sample Position/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sample Drill/ })).toBeInTheDocument();
  });

  test("filtering by a tag narrows to items carrying it", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "reception" })); // only on the Sequence

    expect(screen.queryByRole("button", { name: /Sample Position/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sample Drill/ })).toBeInTheDocument();
  });
});

describe("viewing", () => {
  test("opening a Position shows the read-only view with rendered markdown and no editor controls", async () => {
    const user = await renderApp();

    await openPosition(user);

    expect(screen.getByText("Perimeter defence")).toBeInTheDocument(); // markdown is rendered, not raw
    expect(screen.queryByRole("button", { name: "Add setter" })).not.toBeInTheDocument();
  });

  test("the back button returns from a view to the library grid", async () => {
    const user = await renderApp();

    await openPosition(user);
    await user.click(screen.getByRole("button", { name: /Library/ }));

    expect(screen.getByRole("button", { name: /Sample Drill/ })).toBeInTheDocument();
  });
});

describe("editing markers", () => {
  test("selecting a marker opens the inspector and relabelling updates the court", async () => {
    const user = await renderApp();

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
    const user = await renderApp();

    await openPosition(user);
    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Add middle blocker" }));

    expect(screen.getByRole("img", { name: "Middle blocker 2" })).toBeInTheDocument();
  });

  test("removing the selected marker takes it off the court", async () => {
    const user = await renderApp();

    await openPosition(user);
    await openEditor(user);

    await user.click(screen.getByRole("img", { name: "Setter" }));
    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.queryByRole("img", { name: "Setter" })).not.toBeInTheDocument();
  });

  test("recolouring a marker changes its role", async () => {
    const user = await renderApp();

    await openPosition(user);
    await openEditor(user);

    await user.click(screen.getByRole("img", { name: "Outside hitter 1" }));
    await user.click(screen.getByRole("radio", { name: "Libero" }));

    expect(screen.getByRole("img", { name: "Libero 1" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Outside hitter 1" })).not.toBeInTheDocument();
  });
});

describe("court mode", () => {
  test("switching to basic mode swaps the palette to generic roles", async () => {
    const user = await renderApp();

    await openPosition(user);
    await openEditor(user);
    expect(screen.getByRole("button", { name: "Add setter" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Court settings" }));
    await user.click(screen.getByRole("button", { name: "Basic" }));

    expect(screen.getByRole("button", { name: "Add coach" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add setter" })).not.toBeInTheDocument();
  });

  test("recolours a marker in basic mode, but offers no colours in positions mode", async () => {
    const user = await renderApp();

    await openPosition(user);
    await openEditor(user);

    await user.click(screen.getByRole("img", { name: "Setter" }));
    expect(screen.queryByRole("radiogroup", { name: "Colour" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Court settings" }));
    await user.click(screen.getByRole("button", { name: "Basic" }));
    await user.click(screen.getByRole("button", { name: "Add player" }));
    expect(screen.getByRole("radio", { name: "Blue", checked: true })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Red" }));
    expect(screen.getByRole("radio", { name: "Red", checked: true })).toBeInTheDocument();
  });
});

describe("description", () => {
  test("write/preview renders the markdown while editing", async () => {
    const user = await renderApp();

    await openPosition(user);
    await openEditor(user);

    await user.click(screen.getByRole("tab", { name: "Preview" }));

    expect(screen.getByText("Perimeter defence")).toBeInTheDocument();
  });
});

describe("tags", () => {
  test("a tag added in the editor becomes a library filter", async () => {
    const user = await renderApp();

    await openPosition(user);
    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Add tag" })); // arm the ghost chip
    await user.type(screen.getByLabelText("Add tag"), "Press{enter}");
    await user.click(screen.getByRole("button", { name: "Done" }));
    await user.click(screen.getByRole("button", { name: /Library/ }));

    expect(screen.getByRole("button", { name: "Press" })).toBeInTheDocument();
  });

  test("autocomplete offers an existing tag from elsewhere in the library", async () => {
    const user = await renderApp();

    await openSequence(user); // the Sequence has no "defense" tag; the sample Position does
    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Add tag" })); // arm the ghost chip
    await user.type(screen.getByLabelText("Add tag"), "Def");
    await user.click(await screen.findByRole("option", { name: "defense" }));

    expect(screen.getByRole("button", { name: "Remove defense" })).toBeInTheDocument();
  });

  test("removing a tag in the editor drops it from the item", async () => {
    const user = await renderApp();

    await openPosition(user);
    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Remove defense" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    await user.click(screen.getByRole("button", { name: /Library/ }));

    expect(screen.queryByRole("button", { name: "defense" })).not.toBeInTheDocument();
  });
});

describe("the view/edit flow", () => {
  test("Done commits edits back to the view", async () => {
    const user = await renderApp();

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
    const user = await renderApp();

    await openPosition(user);
    await openEditor(user);

    const title = screen.getByLabelText("Board title");

    await user.clear(title);
    await user.type(title, "Throwaway");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Throwaway")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sample Position (Base Defence)" })).toBeInTheDocument();
  });

  test("creating a board opens a fresh single-step Position and commits on Done", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "New board" }));
    const title = screen.getByLabelText("Board title");

    expect(title).toHaveValue("Untitled board");
    expect(screen.queryByRole("img", { name: "Setter" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Step 1" })).not.toBeInTheDocument(); // a Position has no steps strip

    await user.clear(title);
    await user.type(title, "New press");
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByRole("heading", { name: "New press" })).toBeInTheDocument();
  });

  test("deleting goes through the confirm dialog and returns to the library", async () => {
    const user = await renderApp();

    await openPosition(user);
    await user.click(screen.getByRole("button", { name: "Board actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete board…" }));
    const dialog = await screen.findByRole("alertdialog", { name: /Delete this board/ });

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(screen.queryByRole("button", { name: /Sample Position/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sample Drill/ })).toBeInTheDocument();
  });

  test("cancelling the delete dialog keeps the board", async () => {
    const user = await renderApp();

    await openPosition(user);
    await user.click(screen.getByRole("button", { name: "Board actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete board…" }));
    const dialog = await screen.findByRole("alertdialog", { name: /Delete this board/ });

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: /Library/ }));

    expect(screen.getByRole("button", { name: /Sample Position/ })).toBeInTheDocument();
  });
});

// A Done commit is awaited with automatic retries; a failure keeps the editor open with the draft, and
// a localStorage backup recovers a draft a reload would otherwise have destroyed.
describe("reliable saves", () => {
  const POSITION_ID = "sample-perimeter-defence";
  const BACKUP_KEY = `volleycoach-draft-${POSITION_ID}`;

  test("a failed commit keeps the editor open with the draft, and the next Done retries", async () => {
    const user = await renderApp();

    await openPosition(user);
    await openEditor(user);

    const title = screen.getByLabelText("Board title");

    await user.clear(title);
    await user.type(title, "Press defence");

    failCommits(1); // the commit RPC fails once
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(await screen.findByRole("alert", {}, { timeout: 4000 })).toHaveTextContent(/Couldn’t save/);
    expect(screen.getByLabelText("Board title")).toHaveValue("Press defence");

    await user.click(screen.getByRole("button", { name: "Done" })); // the commit succeeds again

    expect(await screen.findByRole("heading", { name: "Press defence" })).toBeInTheDocument();
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull(); // the successful commit cleared the backup
  });

  test.each([
    ["Restore", "Recovered work"],
    ["Discard", "Sample Position (Base Defence)"],
  ])("the backup prompt's %s opens the editor with the right draft", async (action, expectedTitle) => {
    localStorage.setItem(
      BACKUP_KEY,
      JSON.stringify({ ...SAMPLE_BOARDS[0], title: "Recovered work", updatedAt: Date.now() })
    );

    const user = userEvent.setup();

    window.history.replaceState(null, "", `/t/my-team/board/${POSITION_ID}/edit`);
    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    const dialog = await screen.findByRole("alertdialog", { name: "Restore unsaved changes?" });

    await user.click(within(dialog).getByRole("button", { name: action }));

    await waitFor(() => expect(screen.getByLabelText("Board title")).toHaveValue(expectedTitle));
    if (action === "Discard") expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
  });
});

describe("positions and sequences", () => {
  test("adding a step promotes a Position to a Sequence; removing back to one demotes it", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "New board" }));
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
    const user = await renderApp();

    await openSequence(user);

    expect(screen.getByRole("heading", { name: "Sample Drill (Serve Receive & Sideout)" })).toBeInTheDocument();
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
    expect(screen.getByText(/each cover 40% of the court/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next step" }));

    expect(screen.getByText("2 / 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Step 2" })).toHaveAttribute("aria-current", "true");
  });

  test("clicking a step in playback scrubs straight to it", async () => {
    const user = await renderApp();

    await openSequence(user);
    await user.click(screen.getByRole("button", { name: "Step 3" }));

    expect(screen.getByText("3 / 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Step 3" })).toHaveAttribute("aria-current", "true");
  });

  test("reordering the active step with the keyboard moves it and keeps every step", async () => {
    const user = await renderApp();

    await openSequence(user);
    await openEditor(user);

    const step1 = screen.getByRole("button", { name: "Step 1" });

    expect(step1).toHaveAttribute("aria-current", "true"); // the first step is active on open

    step1.focus();
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}"); // move it one place later

    expect(screen.getByRole("button", { name: "Step 2" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Step 1" })).not.toHaveAttribute("aria-current", "true");
    for (const n of [1, 2, 3, 4]) {
      expect(screen.getByRole("button", { name: `Step ${n}` })).toBeInTheDocument();
    }
  });

  test("editing a step's marker identity carries across steps", async () => {
    const user = await renderApp();

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

// Reached from the board view's overflow menu (Positions and Sequences alike). The clipboard is a
// browser API, so it is mocked; opening either sample board and clicking copies it as a one-board bundle.
describe("board JSON export", () => {
  test.each([
    ["a Position", openPosition, "Sample Position (Base Defence)"],
    ["a Sequence", openSequence, "Sample Drill (Serve Receive & Sideout)"],
  ])("copies %s board's JSON to the clipboard and confirms", async (_label, open, title) => {
    const user = await renderApp();
    // Define the mock after setup, since userEvent.setup installs its own clipboard stub on navigator.
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    await open(user);
    await user.click(screen.getByRole("button", { name: "Board actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Copy JSON" }));

    expect(JSON.parse(writeText.mock.calls[0][0])).toMatchObject({
      formatVersion: FORMAT_VERSION,
      boards: [{ title }],
    });
    // The item stays put and confirms in place, so the menu does not snap shut on the feedback.
    expect(await screen.findByRole("menuitem", { name: "Copied" })).toBeInTheDocument();
  });
});

// The library page-bar menu imports a pasted bundle: the dialog previews it (a court per board and the
// topic titles) before anything is written, and confirming creates the content in the active space.
describe("bundle import", () => {
  test("pasting a bundle previews it and confirming creates its topic and board", async () => {
    const user = await renderApp();
    const bundle = JSON.stringify({
      formatVersion: FORMAT_VERSION,
      topics: [{ ref: "t1", title: "Imported topic" }],
      boards: [
        {
          ref: "b1",
          topicRef: "t1",
          title: "Imported board",
          mode: "positions",
          markers: [{ id: "s", role: "setter" }],
          steps: [{ positions: { s: { x: 0.5, y: 0.5 } } }],
        },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Library actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Import JSON…" }));

    const dialog = screen.getByRole("dialog", { name: "Import JSON" });

    await user.click(within(dialog).getByLabelText("Bundle JSON"));
    await user.paste(bundle);

    // The preview renders before anything is written: the topic title, the board title, its kind.
    expect(within(dialog).getByText("Imported topic")).toBeInTheDocument();
    expect(within(dialog).getByText("Imported board")).toBeInTheDocument();
    expect(within(dialog).getByText("Position")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Import" }));

    // The dialog closes and the new board joins the library; the topic joins the sidebar tree.
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Import JSON" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Imported board/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Imported topic" })).toBeInTheDocument();
  });

  test("a broken bundle shows its errors and cannot be imported", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "Library actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Import JSON…" }));

    const dialog = screen.getByRole("dialog", { name: "Import JSON" });

    await user.click(within(dialog).getByLabelText("Bundle JSON"));
    await user.paste("{broken");

    expect(within(dialog).getByText(/Not valid JSON/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Import" })).toBeDisabled();
  });
});

// The avatar menu is the single account control, holding the System/Light/Dark theme picker.
describe("avatar menu", () => {
  test("picks a theme from the segmented control", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "Account menu" }));

    const picker = screen.getByRole("group", { name: "Theme" });

    expect(within(picker).getByRole("button", { name: "System" })).toBeInTheDocument();
    expect(within(picker).getByRole("button", { name: "Dark" })).toBeInTheDocument();

    await user.click(within(picker).getByRole("button", { name: "Light" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("volleycoach-theme")).toBe("light");
    localStorage.removeItem("volleycoach-theme");
  });

  test("is keyboard-navigable and dismisses on escape", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("menuitem", { name: "Account settings" })).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menuitem", { name: "Account settings" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu" })).toHaveFocus();
  });
});

// The flat seed files "Sample Position (Base Defence)" under Defense and "Sample Drill (Serve Receive
// & Sideout)" under Drills, so the sidebar opens populated. A board card's title is an h3, queried by heading role to stay
// distinct from the note-page curation controls.
describe("notes", () => {
  test("the sidebar navigates All Boards and a note", async () => {
    const user = await renderApp();

    expect(screen.getByRole("button", { name: "All Boards" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sample Position (Base Defence)", level: 3 })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Defense" }));
    expect(screen.getByText(/who digs cross-court/i)).toBeInTheDocument(); // the note's markdown explanation
    expect(screen.getByRole("heading", { name: "Sample Position (Base Defence)", level: 3 })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Sample Drill (Serve Receive & Sideout)", level: 3 })
    ).not.toBeInTheDocument();
  });

  test("nesting a note, the parent page still lists only its directly-filed boards", async () => {
    const user = await renderApp();

    // Nest Drills under Defense from the sidebar menu; "Sample Drill" stays filed in Drills, now a descendant.
    await user.click(screen.getByRole("button", { name: "Organize Drills" }));
    await user.click(screen.getByRole("menuitem", { name: "Nest under Defense" }));

    await user.click(screen.getByRole("button", { name: "Defense" }));
    expect(screen.getByRole("heading", { name: "Sample Position (Base Defence)", level: 3 })).toBeInTheDocument(); // filed here
    expect(screen.queryByRole("heading", { name: "Sample Drill (Serve Receive & Sideout)" })).not.toBeInTheDocument(); // descendant
  });

  test("a new board is unfiled: listed in All Boards but under no note", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "New board" }));
    await user.clear(screen.getByLabelText("Board title"));
    await user.type(screen.getByLabelText("Board title"), "Loose ball");
    await user.click(screen.getByRole("button", { name: "Done" }));
    await user.click(screen.getByRole("button", { name: /Library/ }));

    expect(screen.getByRole("heading", { name: "Loose ball", level: 3 })).toBeInTheDocument(); // in All Boards

    await user.click(screen.getByRole("button", { name: "Defense" }));
    expect(screen.queryByRole("heading", { name: "Loose ball" })).not.toBeInTheDocument(); // filed under no note
  });

  test("adding a board to a note from its view links it there", async () => {
    const user = await renderApp();

    await openSequence(user);

    // The view's quiet backlinks row: the drill already appears in Drills; add it to Rotations too.
    const appearsIn = screen.getByRole("navigation", { name: "Appears in" });

    expect(within(appearsIn).getByRole("button", { name: "Drills" })).toBeInTheDocument();
    await user.click(within(appearsIn).getByRole("button", { name: "Add to note" }));
    await user.click(await screen.findByRole("menuitem", { name: "Rotations" }));

    await user.click(screen.getByRole("button", { name: /Library/ }));
    await user.click(screen.getByRole("button", { name: "Rotations" }));
    expect(
      screen.getByRole("heading", { name: "Sample Drill (Serve Receive & Sideout)", level: 3 })
    ).toBeInTheDocument();
  });

  test("removing a board from a note's group drops it from the page, not the library", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "Defense" }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Remove Sample Position (Base Defence) from group" }));
    await user.click(screen.getByRole("button", { name: "Done" }));

    // The board has left the Defense page entirely...
    expect(screen.queryByRole("heading", { name: "Sample Position (Base Defence)" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "All Boards" }));
    expect(screen.getByRole("heading", { name: "Sample Position (Base Defence)", level: 3 })).toBeInTheDocument();
  });

  test("a coach creates a note and explains it in a text block", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "New note" }));
    await user.click(screen.getByRole("button", { name: "Edit" }));

    const title = screen.getByLabelText("Note title");

    await user.clear(title);
    await user.type(title, "Transition");
    await user.click(screen.getByRole("button", { name: "+ Text block" }));
    await user.type(screen.getByPlaceholderText("Write in markdown…"), "Out of system play.");
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByRole("heading", { name: "Transition", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Out of system play.")).toBeInTheDocument();
  });

  test("deleting a note drops it from the sidebar, leaving its boards in the library", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "Defense" }));
    await user.click(screen.getByRole("button", { name: "Note actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete note…" }));
    const dialog = await screen.findByRole("alertdialog", { name: /Delete this note/ });

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    // Deleting the note returns to All Boards; the boards it referenced survive there.
    expect(screen.queryByRole("button", { name: "Defense" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sample Position (Base Defence)", level: 3 })).toBeInTheDocument();
  });
});

// The UI hides write affordances the database would refuse anyway (the real boundary is RLS). A player
// gets a read-only library; a board's author lock toggles from its view.
describe("permissions", () => {
  test("a player sees a read-only library with no edit affordances", async () => {
    setFakeAuthz({ isAdmin: false, role: "player" });
    const user = await renderApp();

    expect(screen.queryByRole("button", { name: "New board" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New note" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Admin" })).not.toBeInTheDocument();

    await openPosition(user);

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();

    // Viewing still works: the overflow menu offers the JSON export, but not the author lock.
    await user.click(screen.getByRole("button", { name: "Board actions" }));

    expect(screen.getByRole("menuitem", { name: "Copy JSON" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /editing/ })).not.toBeInTheDocument();
  });

  test("an owner opens the access manager from the board view's overflow menu", async () => {
    const user = await renderApp(); // the default fake authz is an admin coach, so it owns the board

    await openPosition(user);
    await user.click(screen.getByRole("button", { name: "Board actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Manage access…" }));

    expect(await screen.findByRole("dialog", { name: "Manage access" })).toBeInTheDocument();
  });
});

// Team management is reached from a gear on the active team in the sidebar's space switcher, shown only to
// a user who may curate that team (a coach or admin). A coach/admin mints a single-use invite link.
// Creating teams is an admin concern split out into the separate Admin panel.
describe("team management", () => {
  test("a coach opens team management from the space-switcher gear and mints an invite link", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "Manage My Team" }));
    await user.click(screen.getByRole("button", { name: "Invite member" }));
    await user.click(screen.getByRole("button", { name: "Create invite link" }));

    expect(await screen.findByDisplayValue(/\/#\/invite\/new-invite-token$/)).toBeInTheDocument();
  });

  test("a player gets no team-management gear, since management is coach-facing", async () => {
    setFakeAuthz({ isAdmin: false, role: "player" });
    await renderApp();

    expect(screen.queryByRole("button", { name: /Manage/ })).not.toBeInTheDocument();
  });

  // The team library's page-bar menu carries a Manage team… entry too, so management is reachable at every
  // sidebar width, not only from the full sidebar's gear. It routes to the same team page.
  test("a coach reaches team management from the team-library page-bar menu", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "Library actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Manage team…" }));

    expect(await screen.findByRole("button", { name: "Invite member" })).toBeInTheDocument();
  });

  test("the personal space's page-bar menu offers no Manage team…", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "Personal" }));
    await screen.findByRole("button", { name: /My Personal Position/ });
    await user.click(screen.getByRole("button", { name: "Library actions" }));

    expect(screen.queryByRole("menuitem", { name: "Manage team…" })).not.toBeInTheDocument();
  });

  test("a player gets no Manage team… on the team library, since management is coach-facing", async () => {
    setFakeAuthz({ isAdmin: false, role: "player" });
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "Library actions" }));

    expect(screen.queryByRole("menuitem", { name: "Manage team…" })).not.toBeInTheDocument();
  });

  test("an admin creates a team through the admin panel, which becomes selectable in the space switcher", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "Admin" }));
    await user.type(screen.getByLabelText("Team name"), "Travel Squad");
    await user.click(screen.getByRole("button", { name: "Create team" }));

    expect(await screen.findByText("Created Travel Squad")).toBeInTheDocument();

    // The admin page stays put after creating; the new team appears in the sidebar switcher.
    expect(await screen.findByRole("button", { name: "Travel Squad" })).toBeInTheDocument();
  });
});

// Every user has a private personal space (My Boards / My Notes) alongside the teams they belong to,
// reached from the sidebar space switcher. It is the owner's alone, so it always allows authoring but
// never team management.
describe("personal space", () => {
  test("switching to the personal space shows My Boards in place of the team library", async () => {
    const user = await renderApp();

    expect(screen.getByRole("button", { name: /Sample Position/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Personal" }));

    expect(await screen.findByRole("button", { name: /My Personal Position/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sample Position/ })).not.toBeInTheDocument();
  });

  test("the personal space offers authoring but no team management", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "Personal" }));

    expect(await screen.findByRole("button", { name: "New board" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Manage/ })).not.toBeInTheDocument();
  });
});

// Sharing exposes a personal board to a team and to a read-only link; copying and promotion move a board
// between spaces. The data layer writes through RLS, which is the real boundary; these cover the wiring.
describe("sharing", () => {
  async function openMyBoard(user: UserEvent): Promise<void> {
    await user.click(screen.getByRole("button", { name: "Personal" }));
    await user.click(await screen.findByRole("button", { name: /My Personal Position/ }));
  }

  test("an owner opens the access manager and sees the board's current grants", async () => {
    const user = await renderApp();

    await openMyBoard(user);
    await user.click(screen.getByRole("button", { name: "Board actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Manage access…" }));

    const dialog = await screen.findByRole("dialog", { name: "Manage access" });

    // The owner's own grant is listed, marked as theirs.
    expect(await within(dialog).findByText(/Coach Casey/)).toBeInTheDocument();
    expect(within(dialog).getByText(/\(you\)/)).toBeInTheDocument();
  });

  // Submenus open on hover in the browser, but happy-dom's zero-size rects break the hover tracking, so
  // these tests drive them with the keyboard (which Base UI supports first-class). The overflow menu leads
  // with Manage access then History, so reaching the Copy to submenu takes two extra steps down.
  test("a viewer copies a team board into My Boards through the Copy to menu", async () => {
    const user = await renderApp();

    await openPosition(user);
    await user.click(screen.getByRole("button", { name: "Board actions" }));
    await screen.findByRole("menuitem", { name: "Copy to" });
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowRight}");
    await screen.findByRole("menuitem", { name: "My Boards" });
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("menuitem", { name: "Copied" })).toBeInTheDocument();
  });

  test("copying to the space the board is in duplicates it there and opens the copy", async () => {
    const user = await renderApp();

    await openPosition(user);
    await user.click(screen.getByRole("button", { name: "Board actions" }));
    await screen.findByRole("menuitem", { name: "Copy to" });
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowRight}");
    await screen.findByRole("menuitem", { name: "My Team (duplicate here)" });
    await user.keyboard("{ArrowDown}{Enter}");

    expect(await screen.findByRole("heading", { name: /Copy of Sample Position/ })).toBeInTheDocument();
  });

  test("a player viewing a team board gets only the flat personal copy, with no move", async () => {
    setFakeAuthz({ isAdmin: false, role: "player" });

    const user = await renderApp();

    await openPosition(user);
    await user.click(screen.getByRole("button", { name: "Board actions" }));

    expect(screen.getByRole("menuitem", { name: "Copy to My Boards" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Move to" })).not.toBeInTheDocument();
  });

  test("a failed duplicate stays on the original board and reports the error", async () => {
    const user = await renderApp();

    await openPosition(user);
    await user.click(screen.getByRole("button", { name: "Board actions" }));
    await screen.findByRole("menuitem", { name: "Copy to" });
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowRight}");
    await screen.findByRole("menuitem", { name: "My Team (duplicate here)" });
    failWrites(3); // outlasts the two automatic retries
    await user.keyboard("{ArrowDown}{Enter}");

    expect(await screen.findByRole("menuitem", { name: "Load failed" }, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Sample Position/ })).toBeInTheDocument();
  });
});

// The Inspiration showcase is a read-only space every user may browse and copy from; only its curators
// (coaches of the showcase team) and admins may author in it.
describe("inspiration space", () => {
  test("a player browses the showcase read-only and copies a board out of it", async () => {
    setFakeAuthz({ isAdmin: false, role: "player" });

    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "Inspiration" }));
    await user.click(await screen.findByRole("button", { name: /Inspiration Example/ }));

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Board actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Copy to My Boards" }));

    expect(await screen.findByRole("menuitem", { name: "Copied" })).toBeInTheDocument();
  });

  test("an admin may author in the showcase", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "Inspiration" }));

    expect(await screen.findByRole("button", { name: "New board" })).toBeInTheDocument();
  });

  test("a non-admin curator manages the Inspiration team through the switcher gear", async () => {
    setFakeAuthz({ isAdmin: false, role: "player", showcaseRole: "coach" });

    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "Inspiration" }));
    await user.click(await screen.findByRole("button", { name: "Manage Inspiration" }));

    expect(await screen.findByRole("button", { name: "Invite member" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join team" })).not.toBeInTheDocument();
  });

  test("an admin on the showcase roster is offered Leave team, not Join team", async () => {
    setFakeAuthz({ showcaseRole: "coach" });

    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "Inspiration" }));
    await user.click(await screen.findByRole("button", { name: "Manage Inspiration" }));

    expect(await screen.findByRole("button", { name: "Leave team" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join team" })).not.toBeInTheDocument();
  });
});

// Every user has a display name. A user with none set must choose one on first login before reaching
// the app; afterwards they change it from the account settings reached through the avatar menu.
describe("display name", () => {
  test("a user with no name set is prompted for one before the app, then enters it", async () => {
    setFakeAuthz({ displayName: null });
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    await screen.findByRole("heading", { name: /What’s your name\?/ });

    // The library is gated behind the prompt until a name is entered.
    expect(screen.queryByRole("button", { name: /Sample Position/ })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Name"), "Coach Casey");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("button", { name: /Sample Position/ })).toBeInTheDocument();
  });

  test("a user with a name set skips the prompt and lands in the app", async () => {
    await renderApp();

    expect(screen.queryByRole("heading", { name: /What’s your name\?/ })).not.toBeInTheDocument();
  });

  test("the account settings page shows the name read-only with the email, and edits it behind the change icon", async () => {
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Account settings" }));

    // The settings page shows the name as text, not a field, until the change icon reveals the input.
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Coach Casey")).toBeInTheDocument();
    expect(screen.getByText(TEST_USER.email)).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Change name" }));

    const name = screen.getByLabelText("Name");

    await user.clear(name);
    await user.type(name, "Coach Morgan");
    await user.click(screen.getByRole("button", { name: "Save" }));

    // Saving returns to the read-only view showing the new name.
    expect(await screen.findByText("Coach Morgan")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });
});

// A share link is the one URL-addressable surface, opening exactly one board read-only. It resolves a
// team board or a shared personal board; an unshared personal board's link does not resolve.
describe("share links", () => {
  function renderShare(token: string): UserEvent {
    const user = userEvent.setup();

    window.location.hash = `#/share/${token}`;
    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    return user;
  }

  test("opens a shared board read-only, with no edit controls", async () => {
    renderShare("token-shared-1");

    expect(await screen.findByRole("heading", { name: "Shared Tactic" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  test("does not resolve an unshared personal board", async () => {
    renderShare("token-personal-1");

    expect(await screen.findByText(/open a board/)).toBeInTheDocument();
  });

  test("lets a coach add the shared board to their team library", async () => {
    const user = renderShare("token-shared-1");

    await screen.findByRole("heading", { name: "Shared Tactic" });
    await user.click(await screen.findByRole("button", { name: "Add to My Team" }));

    expect(await screen.findByText("Added to My Team")).toBeInTheDocument();
  });
});

// Self-service account deletion lives in the avatar menu, available to every signed-in user (admin actions
// on other accounts live in the Admin panel, covered in admin/AdminManager.test).
describe("account deletion", () => {
  test("the avatar menu offers a self-delete action even to a non-admin", async () => {
    setFakeAuthz({ isAdmin: false, role: "player" });
    const user = await renderApp();

    await user.click(screen.getByRole("button", { name: "Account menu" }));

    expect(screen.getByRole("menuitem", { name: "Delete account" })).toBeInTheDocument();
  });
});

// The URL is the single source of truth for navigation: opening a board writes its path, a deep link
// resolves to the board, and an unreadable id lands on the in-app not-found surface (RLS hides the row
// rather than answering 403, so "no access" and "missing" both surface here).
describe("routing", () => {
  function renderAt(path: string): UserEvent {
    const user = userEvent.setup();

    window.history.replaceState(null, "", path);
    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    return user;
  }

  test("opening a board writes its path to the URL", async () => {
    const user = await renderApp();

    expect(window.location.pathname).toBe("/t/my-team");

    await openPosition(user);

    expect(window.location.pathname).toMatch(/^\/t\/my-team\/board\//);
  });

  test("a board deep link resolves to the board, switching to its space", async () => {
    renderAt("/personal/board/personal-board-1");

    expect(await screen.findByRole("heading", { name: "My Personal Position" })).toBeInTheDocument();
  });

  test("an unknown board id lands on the not-found surface", async () => {
    const user = renderAt("/personal/board/does-not-exist");

    // The board resolves over several async hops (auth, workspace, the space switch, the board lookup),
    // so re-query until the not-found surface settles rather than holding a node from an earlier commit.
    await waitFor(() => expect(screen.getByRole("heading", { name: /This page/ })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Go to your library/ }));

    expect(await screen.findByRole("button", { name: /My Personal Position/ })).toBeInTheDocument();
  });
});
