import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { NoteAccessManager } from "../../src/sharing/NoteAccessManager";
import type { Note } from "../../src/notes/types";
import { OTHER_MEMBER, recordedWrites, resetRecorded, TEST_TEAM_ID, TEST_USER } from "../helpers/supabaseFake";

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

describe("NoteAccessManager", () => {
  test("sharing a note writes a grant across its whole subtree", async () => {
    const user = userEvent.setup();

    render(
      <NoteAccessManager
        open
        onOpenChange={() => {}}
        note={NOTES[0]}
        notes={NOTES}
        coachedTeams={[{ teamId: TEST_TEAM_ID, teamName: "My Team", slug: "my-team" }]}
        teamName={() => "My Team"}
        currentUserId={TEST_USER.id}
      />
    );

    // The first combobox is the principal picker; open it and (once the profiles load) pick the teammate.
    await user.click(screen.getAllByRole("combobox")[0]);
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
});
