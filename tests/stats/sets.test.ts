import { beforeEach, describe, expect, test, vi } from "vitest";

import { emptyData } from "../../src/stats/store";
import { writeBackup } from "../../src/stats/sync/setSync";
import type { AppData } from "../../src/stats/types";

// The Supabase side of saving: how the save RPC's answers and failures map onto what the saving logic does.
// Only the Supabase client is faked.

const fake = vi.hoisted(() => ({
  session: true as boolean,
  rpc: vi.fn(),
  rows: [] as { id: string; game_id: string; version: number; data: unknown }[],
}));

vi.mock("../../src/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: fake.session ? { user: { id: "u" } } : null } }) },
    rpc: fake.rpc,
    from: () => ({ select: () => ({ in: async () => ({ data: fake.rows, error: null }) }) }),
  },
}));

const { supabaseSetBackend, updateSets } = await import("../../src/stats/sets");

const data: AppData = {
  ...emptyData(["Mira"]),
  events: [{ kind: "touch", id: 1, timestamp: 1, player: "Mira", stat: "serve", result: "ace", zone: "1" }],
};
const request = { id: "s", gameId: "g", data, base: 3 };

beforeEach(() => {
  fake.session = true;
  fake.rpc.mockReset();
  localStorage.clear();
});

describe("saving through Supabase", () => {
  test("sends the set with its derived score as a compare-and-swap on the version", async () => {
    fake.rpc.mockResolvedValue({ data: { version: 4 }, error: null });

    expect(await supabaseSetBackend.save(request)).toEqual({ kind: "saved", version: 4 });
    expect(fake.rpc).toHaveBeenCalledWith("save_game_set", {
      set_id: "s",
      game: "g",
      content: data,
      base: 3,
      us: 1,
      them: 0,
    });
  });

  test("signed out, nothing is sent and the changes wait for a sign-in", async () => {
    fake.session = false;

    expect(await supabaseSetBackend.save(request)).toEqual({ kind: "signedOut" });
    expect(await supabaseSetBackend.load("s")).toEqual({ kind: "signedOut" });
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  test.each([
    {
      answer: { data: { conflict: true, version: 5, updated_by: "Pat", updated_at: "t" }, error: null },
      kind: "conflict",
    },
    { answer: { data: { missing: true }, error: null }, kind: "missing" },
    { answer: { data: null, error: { code: "PGRST301", message: "JWT expired" } }, kind: "signedOut" },
    { answer: { data: null, error: { code: "42501", message: "not allowed" } }, kind: "refused" },
    { answer: { data: null, error: { code: "22023", message: "not a set" } }, kind: "refused" },
    { answer: { data: null, error: { code: "", message: "TypeError: Failed to fetch" } }, kind: "offline" },
  ])("maps $kind", async ({ answer, kind }) => {
    fake.rpc.mockResolvedValue(answer);

    expect((await supabaseSetBackend.save(request)).kind).toBe(kind);
  });

  test("a conflict carries who saved and the newer version", async () => {
    fake.rpc.mockResolvedValue({
      data: { conflict: true, version: 5, updated_by: "Pat", updated_at: "t" },
      error: null,
    });

    expect(await supabaseSetBackend.save(request)).toEqual({
      kind: "conflict",
      version: 5,
      updatedBy: "Pat",
      updatedAt: "t",
    });
  });
});

describe("updating stored sets", () => {
  const rename = (d: AppData): AppData => ({ ...d, players: d.players.map((p) => (p === "Mira" ? "Mirabel" : p)) });
  const backend = { load: vi.fn(), save: vi.fn() };

  beforeEach(() => {
    backend.load.mockReset();
    backend.save.mockReset();
    fake.rows = [
      { id: "a", game_id: "g", version: 3, data },
      { id: "b", game_id: "g", version: 1, data: emptyData(["Jo"]) },
    ];
  });

  test("saves only the sets that change, on the version they were read at", async () => {
    backend.save.mockResolvedValue({ kind: "saved", version: 4 });

    expect(await updateSets(["g"], rename, backend)).toEqual({ updated: 1, skipped: 0, error: null });
    expect(backend.save).toHaveBeenCalledExactlyOnceWith({ id: "a", gameId: "g", data: rename(data), base: 3 });
  });

  test("a set saved in between is read again and changed again, never overwritten", async () => {
    const theirs = { ...data, players: ["Mira", "Suki"] };

    backend.save.mockResolvedValueOnce({ kind: "conflict", version: 4, updatedBy: "Pat", updatedAt: "" });
    backend.save.mockResolvedValueOnce({ kind: "saved", version: 5 });
    backend.load.mockResolvedValue({ kind: "found", record: { id: "a", gameId: "g", version: 4, data: theirs } });

    expect((await updateSets(["g"], rename, backend)).updated).toBe(1);
    expect(backend.save).toHaveBeenLastCalledWith({ id: "a", gameId: "g", data: rename(theirs), base: 4 });
  });

  test("a set with unsaved changes in this browser, or one the change refuses, is left alone", async () => {
    writeBackup(localStorage, "a", { gameId: "g", baseVersion: 3, data });

    expect(await updateSets(["g"], rename, backend)).toEqual({ updated: 0, skipped: 1, error: null });
    expect(await updateSets(["g"], () => ({ error: "Clash." }), backend)).toMatchObject({ error: "Clash." });
    expect(backend.save).not.toHaveBeenCalled();
  });
});
