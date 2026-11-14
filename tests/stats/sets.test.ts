import { beforeEach, describe, expect, test, vi } from "vitest";

import { emptyData } from "../../src/stats/store";
import { writeBackup } from "../../src/stats/sync/setSync";
import type { AppData } from "../../src/stats/types";

// The Supabase side of saving: how the set RPCs' answers and failures map onto what the saving logic does.
// Only the Supabase client is faked: the working copies come from `rows`, every other RPC from `answer`.

const fake = vi.hoisted(() => ({
  session: true as boolean,
  answer: vi.fn(),
  rows: [] as { id: string; game_id: string; version: number; data: unknown; published: unknown }[],
  /** The columns and filters of the last select. */
  query: [] as string[],
}));

vi.mock("../../src/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: fake.session ? { user: { id: "u" } } : null } }) },
    rpc: (fn: string, params: Record<string, unknown>) => {
      if (fn === "working_game_sets")
        return Promise.resolve({ data: fake.rows.filter((r) => (params.game_ids as string[]).includes(r.game_id)) });
      if (fn === "working_game_set")
        return { maybeSingle: async () => ({ data: fake.rows.find((r) => r.id === params.set_id) ?? null }) };

      return fake.answer(fn, params);
    },
    from: () => ({
      select: (columns: string) => {
        fake.query = [columns];

        const result = { data: fake.rows, error: null };
        const filtered = {
          not: (column: string, op: string, value: unknown) => {
            fake.query.push(`not ${column} ${op} ${value}`);

            return Promise.resolve({ ...result, data: fake.rows.filter((r) => r.published !== null) });
          },
          then: (resolve: (r: typeof result) => unknown) => resolve(result),
        };

        return { in: () => filtered };
      },
    }),
  },
}));

const { importSet, loadGameSets, supabaseSetBackend, updateSets } = await import("../../src/stats/sets");

const data: AppData = {
  ...emptyData(["Mira"]),
  events: [{ kind: "touch", id: 1, timestamp: 1, player: "Mira", stat: "serve", result: "ace", zone: "1" }],
};
const request = { id: "s", gameId: "g", data, base: 3 };

beforeEach(() => {
  fake.session = true;
  fake.answer.mockReset();
  localStorage.clear();
});

describe("saving through Supabase", () => {
  test("sends the set as a compare-and-swap on the version", async () => {
    fake.answer.mockResolvedValue({ data: { version: 4 }, error: null });

    expect(await supabaseSetBackend.save(request)).toEqual({ kind: "saved", version: 4 });
    expect(fake.answer).toHaveBeenCalledWith("save_game_set", { set_id: "s", game: "g", content: data, base: 3 });
  });

  test("loads a set's working copy and its stats through the coaches' RPC", async () => {
    fake.rows = [{ id: "s", game_id: "g", version: 2, data, published: null }];

    expect(await supabaseSetBackend.load("s")).toEqual({
      kind: "found",
      record: { id: "s", gameId: "g", version: 2, data, published: null },
    });
    expect(await supabaseSetBackend.load("other")).toEqual({ kind: "missing" });
  });

  test("signed out, nothing is sent and the changes wait for a sign-in", async () => {
    fake.session = false;

    expect(await supabaseSetBackend.save(request)).toEqual({ kind: "signedOut" });
    expect(await supabaseSetBackend.load("s")).toEqual({ kind: "signedOut" });
    expect(fake.answer).not.toHaveBeenCalled();
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
    fake.answer.mockResolvedValue(answer);

    expect((await supabaseSetBackend.save(request)).kind).toBe(kind);
  });

  test("a conflict carries who saved and the newer version", async () => {
    fake.answer.mockResolvedValue({
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

describe("saving a set's stats", () => {
  test("makes the working copy at the given version the stats, with its derived score for the list", async () => {
    fake.answer.mockResolvedValue({ data: { version: 3 }, error: null });

    expect(await supabaseSetBackend.publish({ id: "s", base: 3, data })).toEqual({ kind: "saved", version: 3 });
    expect(fake.answer).toHaveBeenCalledWith("publish_game_set", { set_id: "s", base: 3, us: 1, them: 0 });
  });

  test("an imported set is created, then its stats are saved on the version it was created at", async () => {
    fake.answer.mockResolvedValueOnce({ data: { version: 1 }, error: null });
    fake.answer.mockResolvedValueOnce({ data: { version: 1 }, error: null });

    expect(await importSet("g", data, "s")).toEqual({ kind: "saved", version: 1 });
    expect(fake.answer.mock.calls.map(([fn, params]) => [fn, params.base])).toEqual([
      ["save_game_set", 0],
      ["publish_game_set", 1],
    ]);
  });

  test("an import that fails to save the set does not try its stats", async () => {
    fake.answer.mockResolvedValue({ data: null, error: { code: "42501", message: "not allowed" } });

    expect((await importSet("g", data, "s")).kind).toBe("refused");
    expect(fake.answer).toHaveBeenCalledOnce();
  });

  test("the stats pages read only saved stats, sets in set order", async () => {
    const numbered = (n: string): AppData => ({ ...data, meta: { ...data.meta, setNumber: n } });

    fake.rows = [
      { id: "b", game_id: "g", version: 1, data: numbered("2"), published: numbered("2") },
      { id: "c", game_id: "g", version: 1, data: numbered("3"), published: null },
      { id: "a", game_id: "g", version: 4, data: numbered("1"), published: data },
    ];

    const { sets } = await loadGameSets(["g"]);

    expect(fake.query).toEqual(["game_id, published", "not published is null"]);
    expect(sets).toEqual([
      { gameId: "g", data },
      { gameId: "g", data: numbered("2") },
    ]);
  });
});

describe("updating stored sets", () => {
  const rename = (d: AppData): AppData => ({ ...d, players: d.players.map((p) => (p === "Mira" ? "Mirabel" : p)) });
  const backend = { load: vi.fn(), relink: vi.fn() };
  const older = emptyData(["Mira"]);

  beforeEach(() => {
    backend.load.mockReset();
    backend.relink.mockReset();
    fake.rows = [
      { id: "a", game_id: "g", version: 3, data, published: older },
      { id: "b", game_id: "g", version: 1, data: emptyData(["Jo"]), published: null },
    ];
  });

  test("changes both copies of the sets it changes, on the version they were read at", async () => {
    backend.relink.mockResolvedValue({ kind: "saved", version: 4 });

    expect(await updateSets(["g"], rename, backend)).toEqual({ updated: 1, skipped: 0, error: null });
    expect(backend.relink).toHaveBeenCalledExactlyOnceWith({
      id: "a",
      data: rename(data),
      published: rename(older),
      base: 3,
    });
  });

  test("sends both copies to the relink RPC", async () => {
    fake.answer.mockResolvedValue({ data: { version: 4 }, error: null });

    expect((await updateSets(["g"], rename)).updated).toBe(1);
    expect(fake.answer).toHaveBeenCalledExactlyOnceWith("relink_game_set", {
      set_id: "a",
      base: 3,
      content: rename(data),
      stats: rename(older),
    });
  });

  test("a set with no saved stats keeps none", async () => {
    backend.relink.mockResolvedValue({ kind: "saved", version: 2 });

    await updateSets(["g"], (d) => ({ ...d, players: [...d.players, "Nina"] }), backend);

    expect(backend.relink).toHaveBeenCalledWith(expect.objectContaining({ id: "b", published: null }));
  });

  test("a set saved in between is read again and changed again, never overwritten", async () => {
    const theirs = { ...data, players: ["Mira", "Suki"] };

    backend.relink.mockResolvedValueOnce({ kind: "conflict", version: 4, updatedBy: "Pat", updatedAt: "" });
    backend.relink.mockResolvedValueOnce({ kind: "saved", version: 5 });
    backend.load.mockResolvedValue({
      kind: "found",
      record: { id: "a", gameId: "g", version: 4, data: theirs, published: theirs },
    });

    expect((await updateSets(["g"], rename, backend)).updated).toBe(1);
    expect(backend.relink).toHaveBeenLastCalledWith({
      id: "a",
      data: rename(theirs),
      published: rename(theirs),
      base: 4,
    });
  });

  test("a set with unsaved changes in this browser, or one the change refuses, is left alone", async () => {
    writeBackup(localStorage, "a", { gameId: "g", baseVersion: 3, data });

    expect(await updateSets(["g"], rename, backend)).toEqual({ updated: 0, skipped: 1, error: null });
    expect(await updateSets(["g"], () => ({ error: "Clash." }), backend)).toMatchObject({ error: "Clash." });
    expect(backend.relink).not.toHaveBeenCalled();
  });

  test("a change the stats refuse leaves the whole set alone", async () => {
    const refuseOlder = (d: AppData) => (d === older ? { error: "Clash in the stats." } : rename(d));

    expect(await updateSets(["g"], refuseOlder, backend)).toMatchObject({ error: "Clash in the stats." });
    expect(backend.relink).not.toHaveBeenCalled();
  });
});
