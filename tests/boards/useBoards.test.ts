import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AuthProvider } from "../../src/auth/useAuth";
import { useBoards } from "../../src/boards/useBoards";
import type { Space } from "../../src/workspace/space";
import { recordedWrites, resetRecorded, TEST_TEAM_ID, TEST_USER } from "../helpers/supabaseFake";

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

    act(() => result.current.updateBoard(target.id, (b) => ({ ...b, autoArrows: false })));

    expect(result.current.boards.find((b) => b.id === target.id)?.autoArrows).toBe(false);

    const write = recordedWrites.find((c) => c.table === "boards" && c.op === "update" && c.eq.id === target.id);

    expect(write?.payload?.auto_arrows).toBe(false);
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
