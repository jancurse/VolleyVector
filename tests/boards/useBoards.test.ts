import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AuthProvider } from "../../src/auth/useAuth";
import { createBoard } from "../../src/boards/operations";
import { COMMIT_CONFLICT, useBoards } from "../../src/boards/useBoards";
import type { Space } from "../../src/workspace/space";
import {
  failWrites,
  recordedRpcs,
  recordedWrites,
  resetRecorded,
  setCommitConflict,
  TEST_TEAM_ID,
  TEST_USER,
} from "../helpers/supabaseFake";

// Mock only the external Supabase client; the real store runs against it.
vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

beforeEach(() => resetRecorded());
afterEach(() => vi.clearAllMocks());

const wrapper = ({ children }: { children: ReactNode }) => createElement(AuthProvider, null, children);
const TEAM_SPACE: Space = { kind: "team", teamId: TEST_TEAM_ID };

// The default fake authz is an admin coach, so the viewer's derived capability on team boards is owner.
function renderBoards() {
  return renderHook(() => useBoards(TEAM_SPACE, true, "coach"), { wrapper });
}

describe("useBoards", () => {
  test("a normal load excludes grace-archived boards and derives the viewer's capability", async () => {
    const { result } = renderBoards();

    await waitFor(() => expect(result.current.boards.length).toBeGreaterThan(0));

    expect(result.current.boards.some((b) => b.title === "Archived Board")).toBe(false);
    expect(result.current.boards.every((b) => b.capability === "owner")).toBe(true);
  });

  test("a commit goes through the conflict-checked RPC and updates the list", async () => {
    const { result } = renderBoards();

    await waitFor(() => expect(result.current.boards.length).toBeGreaterThan(0));

    const target = result.current.boards[0];
    let commitError: string | null = "unset";

    await act(async () => {
      commitError = await result.current.updateBoard({ ...target, autoArrows: false });
    });

    expect(commitError).toBeNull();
    expect(result.current.boards.find((b) => b.id === target.id)?.autoArrows).toBe(false);

    const commit = recordedRpcs.find((c) => c.fn === "commit_board");

    expect((commit?.params as { board: string }).board).toBe(target.id);
    expect((commit?.params as { content: { auto_arrows: boolean } }).content.auto_arrows).toBe(false);
    expect((commit?.params as { base: string | null }).base).toBe(target.currentRevisionId);
  });

  test("a stale base reports a conflict the caller resolves, without changing the list", async () => {
    const { result } = renderBoards();

    await waitFor(() => expect(result.current.boards.length).toBeGreaterThan(0));

    const target = result.current.boards[0];
    let commitError: string | null = null;

    setCommitConflict();
    await act(async () => {
      commitError = await result.current.updateBoard({ ...target, title: "Mine" });
    });

    expect(commitError).toBe(COMMIT_CONFLICT);
    expect(result.current.boards.find((b) => b.id === target.id)?.title).toBe(target.title);
  });

  test("adding a board inserts the row and the creator's owner grant", async () => {
    const { result } = renderBoards();

    await waitFor(() => expect(result.current.boards.length).toBeGreaterThan(0));

    const board = { ...createBoard(Date.now()), createdBy: TEST_USER.id };
    let commitError: string | null = "unset";

    await act(async () => {
      commitError = await result.current.addBoard(board);
    });

    expect(commitError).toBeNull();
    expect(result.current.boards.some((b) => b.id === board.id)).toBe(true);

    const boardInsert = recordedWrites.find((c) => c.table === "boards" && c.op === "insert");
    const grantInsert = recordedWrites.find((c) => c.table === "board_access" && c.op === "insert");

    expect(boardInsert?.payload?.created_by).toBe(TEST_USER.id);
    expect(grantInsert?.payload?.team_id).toBe(TEST_TEAM_ID);
    expect(grantInsert?.payload?.capability).toBe("owner");
  });

  test("a failed grant write removes the orphaned row and reports the error", async () => {
    const { result } = renderBoards();

    await waitFor(() => expect(result.current.boards.length).toBeGreaterThan(0));

    const board = { ...createBoard(Date.now()), createdBy: TEST_USER.id };
    let commitError: string | null = "unset";

    // The board row lands, then the grant write fails past its retries, so the create cleans up after itself.
    failWrites(3, "Load failed", undefined, "board_access");
    await act(async () => {
      commitError = await result.current.addBoard(board);
    });

    expect(commitError).toBe("Load failed");
    expect(result.current.boards.some((b) => b.id === board.id)).toBe(false);

    const cleanup = recordedRpcs.find((c) => c.fn === "delete_orphan_board");

    expect((cleanup?.params as { board: string }).board).toBe(board.id);
  });

  test("deleting a board detaches the team's grant and drops it from the list", async () => {
    const { result } = renderBoards();

    await waitFor(() => expect(result.current.boards.length).toBeGreaterThan(0));

    const target = result.current.boards[0];

    act(() => result.current.deleteBoard(target.id));

    expect(result.current.boards.some((b) => b.id === target.id)).toBe(false);

    const write = recordedWrites.find((c) => c.table === "board_access" && c.op === "delete");

    expect(write?.eq.board_id).toBe(target.id);
    expect(write?.eq.team_id).toBe(TEST_TEAM_ID);
  });
});
