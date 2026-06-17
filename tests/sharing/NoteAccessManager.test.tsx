import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { NoteAccessManager } from "../../src/sharing/NoteAccessManager";
import type { Note } from "../../src/notes/types";
import {
  OTHER_MEMBER,
  recordedRpcs,
  recordedWrites,
  resetRecorded,
  TEST_TEAM_ID,
  TEST_USER,
} from "../helpers/supabaseFake";

// Mock only the external Supabase client; the real component runs against it.
vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

beforeEach(() => resetRecorded());
afterEach(() => vi.clearAllMocks());

const note = (id: string, parentId: string | null): Note => ({
  id,
  title: id,
  slug: id,
  blocks: [],
  parentId,
  order: 0,
  capability: "owner",
  currentRevisionId: null,
});

// A root note with one subnote, so a share must write a grant per node.
const NOTES: Note[] = [note("root", null), note("child", "root")];
// A stable array, so the candidate-loading effect (keyed on the member teams) runs once per render.
const TEAMS = [{ teamId: TEST_TEAM_ID, teamName: "My Team", slug: "my-team" }];

function renderManager() {
  return render(
    <NoteAccessManager
      open
      onOpenChange={() => {}}
      note={NOTES[0]}
      notes={NOTES}
      coachedTeams={TEAMS}
      memberTeams={TEAMS}
      teamName={() => "My Team"}
      currentUserId={TEST_USER.id}
    />
  );
}

describe("NoteAccessManager", () => {
  test("sharing a note writes a grant across its whole subtree", async () => {
    const user = userEvent.setup();

    renderManager();

    // Open the relationship-scoped picker (named by its "Add a person or team" aria-label) and pick the teammate.
    await user.click((await screen.findAllByRole("combobox", { name: "Add a person or team" }))[0]);
    await user.click(await screen.findByRole("option", { name: "Player Pat" }));
    await user.click(screen.getByRole("button", { name: "Add" }));

    const insert = await waitFor(() => {
      const write = recordedWrites.find((c) => c.table === "topic_access" && c.op === "insert");

      expect(write).toBeDefined();

      return write!;
    });

    const rows = insert.payload as unknown as Array<{ topic_id: string; user_id: string; capability: string }>;

    expect(rows.map((r) => r.topic_id).sort()).toEqual(["child", "root"]);
    expect(rows.every((r) => r.user_id === OTHER_MEMBER.id && r.capability === "editor")).toBe(true);
  });

  test("sharing a note by exact email calls grant_topic_by_email", async () => {
    const user = userEvent.setup();

    renderManager();

    await user.type(await screen.findByRole("textbox", { name: "By email" }), "stranger@example.com");
    await user.click(screen.getByRole("button", { name: "Share" }));

    // The outside-team default capability is viewer; the reply is uniform whether or not an account matched.
    await waitFor(() => expect(recordedRpcs.some((c) => c.fn === "grant_topic_by_email")).toBe(true));
    const call = recordedRpcs.find((c) => c.fn === "grant_topic_by_email");

    expect(call?.params).toMatchObject({ root: "root", addr: "stranger@example.com", cap: "viewer" });
    expect(await screen.findByText(/it now has access to this note/i)).toBeInTheDocument();
  });

  test("the note grant link inserts an access_links row with the topic id", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    renderManager();

    await user.click(screen.getByRole("button", { name: "Copy share link" }));

    const insert = await waitFor(() => {
      const write = recordedWrites.find((c) => c.table === "access_links" && c.op === "insert");

      expect(write).toBeDefined();

      return write!;
    });

    expect(insert.payload).toMatchObject({ topic_id: "root", capability: "viewer" });
  });
});
