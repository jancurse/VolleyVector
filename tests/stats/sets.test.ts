import { beforeEach, describe, expect, test, vi } from "vitest";

import { emptyData } from "../../src/stats/store";
import { writeBackup } from "../../src/stats/sync/setSync";
import type { AppData } from "../../src/stats/types";

// The Supabase side of saving: how the save RPC's answers and failures map onto what the saving logic does.
// Only the Supabase client is faked.

const fake = vi.hoisted(() => ({
  session: true as boolean,
  rpc: vi.fn(),
  rows: [] as { id: string; game_id: string; version: number; data: unknown; published?: unknown }[],
}));

vi.mock("../../src/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: fake.session ? { user: { id: "u" } } : null } }) },
    rpc: fake.rpc,
    from: () => ({ select: () => ({ in: async () => ({ data: fake.rows, error: null }) }) }),
  },
}));

const { addSet, saveSetScore, supabaseSetBackend, updateSets } = await import("../../src/stats/sets");
const { trackedScore } = await import("../../src/stats/rallies");

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
  test("saves the set as a compare-and-swap on the version, and its stats with their derived score", async () => {
    fake.rpc.mockResolvedValue({ data: { version: 4 }, error: null });

    expect(await supabaseSetBackend.save(request)).toEqual({ kind: "saved", version: 4 });
    expect(fake.rpc).toHaveBeenCalledWith("save_game_set", { set_id: "s", game: "g", content: data, base: 3 });

    await supabaseSetBackend.publish({ id: "s", base: 4, data });
    expect(fake.rpc).toHaveBeenLastCalledWith("publish_game_set", { set_id: "s", base: 4, us: 1, them: 0 });
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
  const backend = { load: vi.fn(), relink: vi.fn() };

  beforeEach(() => {
    backend.load.mockReset();
    backend.relink.mockReset();
    fake.rows = [
      { id: "a", game_id: "g", version: 3, data, published: data },
      { id: "b", game_id: "g", version: 1, data: emptyData(["Jo"]), published: null },
    ];
  });

  test("saves both copies of only the sets that change, on the version they were read at", async () => {
    backend.relink.mockResolvedValue({ kind: "saved", version: 4 });

    expect(await updateSets(["g"], rename, backend)).toEqual({ updated: 1, skipped: 0, error: null });
    expect(backend.relink).toHaveBeenCalledExactlyOnceWith({
      id: "a",
      data: rename(data),
      published: rename(data),
      base: 3,
    });
  });

  test("a set saved in between is read again and changed again, never overwritten", async () => {
    const theirs = { ...data, players: ["Mira", "Suki"] };

    backend.relink.mockResolvedValueOnce({ kind: "conflict", version: 4, updatedBy: "Pat", updatedAt: "" });
    backend.relink.mockResolvedValueOnce({ kind: "saved", version: 5 });
    backend.load.mockResolvedValue({ kind: "found", record: { id: "a", gameId: "g", version: 4, data: theirs } });

    expect((await updateSets(["g"], rename, backend)).updated).toBe(1);
    expect(backend.relink).toHaveBeenLastCalledWith({ id: "a", data: rename(theirs), published: null, base: 4 });
  });

  test("a set with unsaved changes in this browser, or one the change refuses, is left alone", async () => {
    writeBackup(localStorage, "a", { gameId: "g", baseVersion: 3, data });

    expect(await updateSets(["g"], rename, backend)).toEqual({ updated: 0, skipped: 1, error: null });
    expect(await updateSets(["g"], () => ({ error: "Clash." }), backend)).toMatchObject({ error: "Clash." });
    expect(backend.relink).not.toHaveBeenCalled();
  });
});

describe("adding a set", () => {
  test("saves it straight away as a new set of its game", async () => {
    fake.rpc.mockResolvedValue({ data: { version: 1 }, error: null });

    expect(await addSet("g", emptyData())).toBeNull();
    expect(fake.rpc).toHaveBeenCalledWith("save_game_set", expect.objectContaining({ game: "g", base: 0 }));
  });
});

describe("a typed-in score", () => {
  const stored = (d: AppData, published: AppData | null = d) => ({
    kind: "found",
    record: { id: "s", gameId: "g", version: 2, data: d, published },
  });
  const typedIn = (score: unknown) => expect.objectContaining({ meta: expect.objectContaining({ score }) });
  const backendWith = (record: ReturnType<typeof stored>) => ({
    load: vi.fn().mockResolvedValue(record),
    save: vi.fn().mockResolvedValue({ kind: "saved", version: 3 }),
    publish: vi.fn().mockResolvedValue({ kind: "saved", version: 3 }),
  });

  test("is saved and then saved as the stats, with or without events, and wins over the events' score", async () => {
    const empty = backendWith(stored(emptyData(), null));

    expect(await saveSetScore("s", { us: 15, them: 13 }, empty)).toBeNull();
    expect(empty.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: "s", gameId: "g", base: 2, data: typedIn({ us: 15, them: 13 }) })
    );
    expect(empty.publish).toHaveBeenCalledWith({ id: "s", base: 3, data: typedIn({ us: 15, them: 13 }) });

    const tracked = backendWith(stored(data));

    expect(await saveSetScore("s", { us: 25, them: 23 }, tracked)).toBeNull();
    expect(tracked.publish).toHaveBeenCalledWith(expect.objectContaining({ data: typedIn({ us: 25, them: 23 }) }));
  });

  test("typing the score the events give clears it", async () => {
    const typed = { ...data, meta: { ...data.meta, score: { us: 25, them: 23 } } };
    const backend = backendWith(stored(typed));

    expect(await saveSetScore("s", trackedScore(data), backend)).toBeNull();
    expect(backend.save.mock.calls[0][0].data.meta).not.toHaveProperty("score");
  });

  test("leaves a set alone whose recording has changes not saved as stats", async () => {
    const backend = backendWith(stored(data, null));

    expect(await saveSetScore("s", { us: 25, them: 23 }, backend)).toMatch(/not saved yet/);
    expect(backend.save).not.toHaveBeenCalled();
  });

  test("reports a set that is gone", async () => {
    const backend = { load: vi.fn().mockResolvedValue({ kind: "missing" }), save: vi.fn(), publish: vi.fn() };

    expect(await saveSetScore("s", { us: 1, them: 0 }, backend)).toBe("The set is gone.");
    expect(backend.save).not.toHaveBeenCalled();
  });
});
