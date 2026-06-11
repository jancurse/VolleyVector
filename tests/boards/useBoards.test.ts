import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AuthProvider } from "../../src/auth/useAuth";
import { createBoard } from "../../src/boards/operations";
import { useBoards } from "../../src/boards/useBoards";
import type { Space } from "../../src/workspace/space";
import { failWrites, recordedWrites, resetRecorded, TEST_TEAM_ID, TEST_USER } from "../helpers/supabaseFake";

// Mock only the external Supabase client; the real store runs against it.
vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

beforeEach(() => resetRecorded());
afterEach(() => vi.clearAllMocks());

const wrapper = ({ children }: { children: ReactNode }) => createElement(AuthProvider, null, children);
const TEAM_SPACE: Space = { kind: "team", teamId: TEST_TEAM_ID };

function renderBoards() {
  return renderHook(() => useBoards(TEAM_SPACE), { wrapper });
}

describe("useBoards", () => {
  test("a normal load excludes grace-archived boards", async () => {
    const { result } = renderBoards();

    await waitFor(() => expect(result.current.boards.length).toBeGreaterThan(0));

    expect(result.current.boards.some((b) => b.title === "Archived Board")).toBe(false);
  });

  test("toggling autoArrows writes auto_arrows through to the board row", async () => {
    const { result } = renderBoards();

    await waitFor(() => expect(result.current.boards.length).toBeGreaterThan(0));

    const target = result.current.boards[0];

    await act(async () => {
      await result.current.updateBoard({ ...target, autoArrows: false });
    });

    expect(result.current.boards.find((b) => b.id === target.id)?.autoArrows).toBe(false);

    const write = recordedWrites.find((c) => c.table === "boards" && c.op === "update" && c.eq.id === target.id);

    expect(write?.payload?.auto_arrows).toBe(false);
  });

  test("a transient commit failure saves on automatic retry without surfacing an error", async () => {
    const { result } = renderBoards();

    await waitFor(() => expect(result.current.boards.length).toBeGreaterThan(0));

    const target = result.current.boards[0];
    let commitError: string | null = "unset";

    failWrites(1);
    await act(async () => {
      commitError = await result.current.updateBoard({ ...target, title: "Retried" });
    });

    expect(commitError).toBeNull();
    expect(result.current.boards.find((b) => b.id === target.id)?.title).toBe("Retried");
    expect(result.current.error).toBeNull();
  });

  test("a duplicate-key insert counts as success, being this board's own response-lost earlier attempt", async () => {
    const { result } = renderBoards();

    await waitFor(() => expect(result.current.boards.length).toBeGreaterThan(0));

    const board = { ...createBoard(Date.now()), owner: TEST_USER.id };
    let commitError: string | null = "unset";

    failWrites(1, "duplicate key value violates unique constraint", "23505");
    await act(async () => {
      commitError = await result.current.addBoard(board);
    });

    expect(commitError).toBeNull();
    expect(result.current.boards.some((b) => b.id === board.id)).toBe(true);
    // The duplicate key already proves the row exists, so no retry is issued.
    expect(recordedWrites.filter((c) => c.op === "insert")).toHaveLength(1);
  });

  test("an exhausted commit reports the error and leaves the list untouched", async () => {
    const { result } = renderBoards();

    await waitFor(() => expect(result.current.boards.length).toBeGreaterThan(0));

    const target = result.current.boards[0];
    let commitError: string | null = null;

    failWrites(3);
    await act(async () => {
      commitError = await result.current.updateBoard({ ...target, title: "Lost?" });
    });

    expect(commitError).toBe("Load failed");
    expect(result.current.boards.find((b) => b.id === target.id)?.title).toBe(target.title);
    // The failure belongs to the caller, not the store banner, and triggers no refetch-overwrite.
    expect(result.current.error).toBeNull();
    expect(recordedWrites.filter((c) => c.op === "update")).toHaveLength(3);
  });

  test("deleting a board issues a soft-delete write and drops it from the list", async () => {
    const { result } = renderBoards();

    await waitFor(() => expect(result.current.boards.length).toBeGreaterThan(0));

    const target = result.current.boards[0];

    act(() => result.current.deleteBoard(target.id));

    expect(result.current.boards.some((b) => b.id === target.id)).toBe(false);

    const write = recordedWrites.find((c) => c.table === "boards" && c.op === "update");

    expect(write?.eq.id).toBe(target.id);
    expect(typeof write?.payload?.deleted_at).toBe("string");
    expect(write?.payload?.deleted_by).toBe(TEST_USER.id);
  });
});
