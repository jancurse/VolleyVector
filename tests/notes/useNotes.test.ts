import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AuthProvider } from "../../src/auth/useAuth";
import { useNotes } from "../../src/notes/useNotes";
import type { Space } from "../../src/workspace/space";
import { failWrites, recordedRpcs, resetRecorded, TEST_TEAM_ID } from "../helpers/supabaseFake";

// Mock only the external Supabase client; the real store runs against it.
vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

beforeEach(() => resetRecorded());
afterEach(() => vi.clearAllMocks());

const wrapper = ({ children }: { children: ReactNode }) => createElement(AuthProvider, null, children);
const TEAM_SPACE: Space = { kind: "team", teamId: TEST_TEAM_ID };

// The default fake authz is an admin coach, so the viewer's derived capability on team notes is owner.
function renderNotes() {
  return renderHook(() => useNotes(TEAM_SPACE, true, "coach"), { wrapper });
}

describe("useNotes", () => {
  test("a normal load excludes grace-archived notes and derives the viewer's capability", async () => {
    const { result } = renderNotes();

    await waitFor(() => expect(result.current.notes.length).toBeGreaterThan(0));

    expect(result.current.notes.some((t) => t.title === "Archived Note")).toBe(false);
    expect(result.current.notes.every((t) => t.capability === "owner")).toBe(true);
  });

  test("a non-coach member reads a team note's grant as viewer", async () => {
    const { result } = renderHook(() => useNotes(TEAM_SPACE, false, "player"), { wrapper });

    await waitFor(() => expect(result.current.notes.length).toBeGreaterThan(0));

    expect(result.current.notes.every((t) => t.capability === "viewer")).toBe(true);
  });

  test("removing a note calls the soft_delete_topic RPC and drops it from the tree", async () => {
    const { result } = renderNotes();

    await waitFor(() => expect(result.current.notes.length).toBeGreaterThan(0));

    const target = result.current.notes[0];

    act(() => result.current.removeNote(target.id));

    expect(result.current.notes.some((t) => t.id === target.id)).toBe(false);

    const rpc = recordedRpcs.find((c) => c.fn === "soft_delete_topic");

    expect(rpc?.params).toEqual({ root: target.id });
  });

  test("a failed grant write cleans up the orphaned note via delete_orphan_topic", async () => {
    const { result } = renderNotes();

    await waitFor(() => expect(result.current.notes.length).toBeGreaterThan(0));

    // The note row lands, then the grant write fails past its retries, so the create cleans up after itself.
    failWrites(3, "Load failed", undefined, "topic_access");

    let newId = "";

    act(() => {
      newId = result.current.addNote(null);
    });

    await waitFor(
      () => {
        const cleanup = recordedRpcs.find((c) => c.fn === "delete_orphan_topic");

        expect((cleanup?.params as { topic: string }).topic).toBe(newId);
      },
      { timeout: 5000 }
    );

    await waitFor(() => expect(result.current.error).toBe("Load failed"), { timeout: 5000 });
  }, 10000);
});
