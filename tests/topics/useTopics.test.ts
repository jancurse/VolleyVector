import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AuthProvider } from "../../src/auth/useAuth";
import { useTopics } from "../../src/topics/useTopics";
import type { Space } from "../../src/workspace/space";
import { recordedRpcs, resetRecorded, TEST_TEAM_ID } from "../helpers/supabaseFake";

// Mock only the external Supabase client; the real store runs against it.
vi.mock("../../src/supabase/client", async () => {
  const mod = await import("../helpers/supabaseFake");

  return { supabase: mod.supabaseFake };
});

beforeEach(() => resetRecorded());
afterEach(() => vi.clearAllMocks());

const wrapper = ({ children }: { children: ReactNode }) => createElement(AuthProvider, null, children);
const TEAM_SPACE: Space = { kind: "team", teamId: TEST_TEAM_ID };

function renderTopics() {
  return renderHook(() => useTopics(TEAM_SPACE), { wrapper });
}

describe("useTopics", () => {
  test("a normal load excludes grace-archived topics", async () => {
    const { result } = renderTopics();

    await waitFor(() => expect(result.current.topics.length).toBeGreaterThan(0));

    expect(result.current.topics.some((t) => t.title === "Archived Topic")).toBe(false);
  });

  test("removing a topic calls the soft_delete_topic RPC and drops it from the tree", async () => {
    const { result } = renderTopics();

    await waitFor(() => expect(result.current.topics.length).toBeGreaterThan(0));

    const target = result.current.topics[0];

    act(() => result.current.removeTopic(target.id));

    expect(result.current.topics.some((t) => t.id === target.id)).toBe(false);

    const rpc = recordedRpcs.find((c) => c.fn === "soft_delete_topic");

    expect(rpc?.params).toEqual({ root: target.id });
  });
});
