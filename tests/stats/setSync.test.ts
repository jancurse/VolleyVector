import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { emptyData } from "../../src/stats/store";
import { readBackup, RETRY_DELAY, SAVE_DELAY, SetSync, writeBackup } from "../../src/stats/sync/setSync";
import type { BackupStore, LoadOutcome, SaveOutcome, SaveRequest, SetBackend } from "../../src/stats/sync/setSync";
import type { AppData } from "../../src/stats/types";
import { GAME as GAME_DATA } from "../helpers/gameData";

// The saving rules, driven through a fake backend that can be offline, signed out, slow, or have a newer
// copy saved by someone else, and an in-memory browser storage that survives a "closed tab".

const SET = "set-1";
const GAME = "game-1";

const withEvents = (n: number): AppData => ({
  ...emptyData(["Mira"]),
  events: Array.from({ length: n }, (_, i) => ({
    kind: "point" as const,
    id: i + 1,
    timestamp: i + 1,
    winner: "us" as const,
  })),
});

function memoryStore(): BackupStore & { map: Map<string, string> } {
  const map = new Map<string, string>();

  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

type Mode = "online" | "offline" | "signedOut";

/** A server holding one set, with a switch for the network and the session. */
function fakeServer(initial: { version: number; data: AppData; published?: AppData | null } | null) {
  let record = initial;
  let mode: Mode = "online";
  const saves: SaveRequest[] = [];
  let gate: Promise<void> | null = null;
  let answerLost = false;

  const backend: SetBackend = {
    async load(): Promise<LoadOutcome> {
      if (mode === "offline") return { kind: "offline", message: "Failed to fetch" };
      if (mode === "signedOut") return { kind: "signedOut" };

      return record ? { kind: "found", record: { id: SET, gameId: GAME, ...record } } : { kind: "missing" };
    },
    async save(request): Promise<SaveOutcome> {
      if (gate) await gate;
      if (mode === "offline") return { kind: "offline", message: "Failed to fetch" };
      if (mode === "signedOut") return { kind: "signedOut" };

      saves.push(request);

      if (!record) {
        if (request.base !== 0) return { kind: "missing" };

        record = { version: 1, data: request.data };

        return { kind: "saved", version: 1 };
      }

      if (request.base !== record.version)
        return { kind: "conflict", version: record.version, updatedBy: "Pat", updatedAt: "2026-11-10T20:00:00Z" };

      record = { ...record, version: record.version + 1, data: request.data };

      if (answerLost) {
        answerLost = false;

        return { kind: "offline", message: "The server took too long to answer." };
      }

      return { kind: "saved", version: record.version };
    },
    async publish({ base }): Promise<SaveOutcome> {
      if (mode === "offline") return { kind: "offline", message: "Failed to fetch" };
      if (!record) return { kind: "missing" };
      if (base !== record.version)
        return { kind: "conflict", version: record.version, updatedBy: "Pat", updatedAt: "2026-11-10T20:00:00Z" };

      record = { ...record, published: record.data };

      return { kind: "saved", version: base };
    },
  };

  return {
    backend,
    saves,
    get record() {
      return record;
    },
    setMode: (m: Mode) => (mode = m),
    /** The next save reaches the server, but its answer never comes back. */
    loseAnswer: () => (answerLost = true),
    /** Someone else saves the set. */
    saveElsewhere: (data: AppData) => {
      record = { ...record, version: (record?.version ?? 0) + 1, data };
    },
    /** Hold saves until the returned release is called, to change things while one is in flight. */
    hold: () => {
      let release = () => {};

      gate = new Promise((resolve) => (release = resolve));

      return () => {
        gate = null;
        release();
      };
    },
  };
}

async function openReady(sync: SetSync): Promise<AppData> {
  const opened = await sync.open();

  if (opened.kind !== "ready") throw new Error(`expected ready, got ${opened.kind}`);

  return opened.data;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("saving a set", () => {
  test("keeps every change in the browser at once, saves shortly after, then clears the local copy", async () => {
    const server = fakeServer({ version: 1, data: emptyData(["Mira"]) });
    const store = memoryStore();
    const sync = new SetSync(SET, GAME, server.backend, store);

    await openReady(sync);
    sync.change(withEvents(1));

    expect(readBackup(store, SET)).toEqual({ gameId: GAME, baseVersion: 1, data: withEvents(1) });
    expect(sync.getSnapshot().saveState).toBe("unsaved");
    expect(server.saves).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(SAVE_DELAY);

    expect(server.record).toEqual({ version: 2, data: withEvents(1) });
    expect(readBackup(store, SET)).toBeNull();
    expect(sync.getSnapshot().saveState).toBe("saved");
  });

  test.each<{ mode: Mode; state: string }>([
    { mode: "offline", state: "offline" },
    { mode: "signedOut", state: "signedOut" },
  ])("while $mode, keeps the changes and retries until the server has them", async ({ mode, state }) => {
    const server = fakeServer({ version: 1, data: emptyData() });
    const store = memoryStore();
    const sync = new SetSync(SET, GAME, server.backend, store);

    await openReady(sync);
    server.setMode(mode);
    sync.change(withEvents(1));
    await vi.advanceTimersByTimeAsync(SAVE_DELAY);

    expect(sync.getSnapshot().saveState).toBe(state);
    expect(readBackup(store, SET)?.data).toEqual(withEvents(1));

    // Recording carries on: each change still lands in the browser first.
    sync.change(withEvents(2));
    expect(readBackup(store, SET)?.data).toEqual(withEvents(2));
    await vi.advanceTimersByTimeAsync(RETRY_DELAY * 3);
    expect(server.record?.version).toBe(1);

    server.setMode("online");
    await vi.advanceTimersByTimeAsync(RETRY_DELAY);

    expect(server.record).toEqual({ version: 2, data: withEvents(2) });
    expect(readBackup(store, SET)).toBeNull();
    expect(sync.getSnapshot().saveState).toBe("saved");
  });

  test("a change made while a save is in flight is kept on the new version and saved next", async () => {
    const server = fakeServer({ version: 1, data: emptyData() });
    const store = memoryStore();
    const sync = new SetSync(SET, GAME, server.backend, store);

    await openReady(sync);
    sync.change(withEvents(1));

    const release = server.hold();

    await vi.advanceTimersByTimeAsync(SAVE_DELAY);
    expect(sync.pending).toBe(true);
    sync.change(withEvents(2));
    release();
    await vi.advanceTimersByTimeAsync(0);

    // The server has the first change; the second is still local, now based on version 2.
    expect(server.record).toEqual({ version: 2, data: withEvents(1) });
    expect(readBackup(store, SET)).toEqual({ gameId: GAME, baseVersion: 2, data: withEvents(2) });

    await vi.advanceTimersByTimeAsync(SAVE_DELAY);
    expect(server.record).toEqual({ version: 3, data: withEvents(2) });
    expect(readBackup(store, SET)).toBeNull();
  });

  test("flush saves at once and reports whether the server has everything", async () => {
    const server = fakeServer({ version: 1, data: emptyData() });
    const sync = new SetSync(SET, GAME, server.backend, memoryStore());

    await openReady(sync);
    sync.change(withEvents(1));
    expect(await sync.flush()).toBe(true);

    server.setMode("offline");
    sync.change(withEvents(2));
    expect(await sync.flush()).toBe(false);
  });

  test("flags a browser that refuses the local copy", async () => {
    const server = fakeServer({ version: 1, data: emptyData() });
    const store = memoryStore();

    store.setItem = () => {
      throw new Error("QuotaExceededError");
    };

    const sync = new SetSync(SET, GAME, server.backend, store);

    await openReady(sync);
    sync.change(withEvents(1));

    expect(sync.getSnapshot().storageFailed).toBe(true);
  });

  test("a set deleted from the game stops saving and keeps the local copy", async () => {
    const server = fakeServer({ version: 1, data: emptyData() });
    const store = memoryStore();
    const deleted: SetBackend = { ...server.backend, save: async () => ({ kind: "missing" }) };
    const sync = new SetSync(SET, GAME, deleted, store);

    await openReady(sync);
    sync.change(withEvents(1));
    await vi.advanceTimersByTimeAsync(SAVE_DELAY);

    expect(sync.getSnapshot().saveState).toBe("refused");
    expect(readBackup(store, SET)?.data).toEqual(withEvents(1));
  });
});

describe("closing the tab and coming back", () => {
  test("changes that never reached the server are restored and saved on reopening", async () => {
    const server = fakeServer({ version: 1, data: emptyData() });
    const store = memoryStore();
    const first = new SetSync(SET, GAME, server.backend, store);

    await openReady(first);
    server.setMode("offline");
    first.change(withEvents(3));
    // The tab closes before any save gets through.
    first.dispose();
    server.setMode("online");

    const reopened = new SetSync(SET, GAME, server.backend, store);

    expect(await openReady(reopened)).toEqual(withEvents(3));
    await vi.advanceTimersByTimeAsync(0);
    expect(server.record).toEqual({ version: 2, data: withEvents(3) });
    expect(readBackup(store, SET)).toBeNull();
  });

  test("reopening while offline carries on from the local copy", async () => {
    const server = fakeServer({ version: 1, data: emptyData() });
    const store = memoryStore();

    writeBackup(store, SET, { gameId: GAME, baseVersion: 1, data: withEvents(2) });
    server.setMode("offline");

    const sync = new SetSync(SET, GAME, server.backend, store);

    expect(await openReady(sync)).toEqual(withEvents(2));
    expect(sync.getSnapshot().saveState).toBe("offline");

    server.setMode("online");
    await vi.advanceTimersByTimeAsync(RETRY_DELAY);
    expect(server.record).toEqual({ version: 2, data: withEvents(2) });
  });

  test("a local copy the server already has is dropped quietly", async () => {
    const server = fakeServer({ version: 4, data: withEvents(2) });
    const store = memoryStore();

    writeBackup(store, SET, { gameId: GAME, baseVersion: 3, data: withEvents(2) });

    const sync = new SetSync(SET, GAME, server.backend, store);

    expect(await openReady(sync)).toEqual(withEvents(2));
    expect(readBackup(store, SET)).toBeNull();
    expect(sync.getSnapshot().saveState).toBe("saved");
  });
});

describe("a set started in the browser", () => {
  test("started offline and reloaded before it reached the server, it is created once back online", async () => {
    const server = fakeServer(null);
    const store = memoryStore();

    // Started: only the local copy exists (base version 0).
    writeBackup(store, SET, { gameId: GAME, baseVersion: 0, data: emptyData(["Mira"]) });
    server.setMode("offline");

    const first = new SetSync(SET, GAME, server.backend, store);

    await openReady(first);
    first.change(withEvents(1));
    await vi.advanceTimersByTimeAsync(SAVE_DELAY);
    first.dispose();

    // Reloaded, still offline: the set opens from the local copy.
    const reloaded = new SetSync(SET, GAME, server.backend, store);

    expect(await openReady(reloaded)).toEqual(withEvents(1));
    expect(server.record).toBeNull();

    server.setMode("online");
    await vi.advanceTimersByTimeAsync(RETRY_DELAY);

    expect(server.saves.map((s) => s.base)).toEqual([0]);
    expect(server.record).toEqual({ version: 1, data: withEvents(1) });
    expect(readBackup(store, SET)).toBeNull();
  });

  test("a set the server never had and this browser has no copy of is missing", async () => {
    const sync = new SetSync(SET, GAME, fakeServer(null).backend, memoryStore());

    expect(await sync.open()).toEqual({ kind: "missing", backup: null });
  });
});

describe("two places saving the same set", () => {
  test("a save on a newer server copy stops and waits for the coach; keep mine overwrites", async () => {
    const server = fakeServer({ version: 1, data: emptyData() });
    const store = memoryStore();
    const sync = new SetSync(SET, GAME, server.backend, store);

    await openReady(sync);
    server.saveElsewhere(withEvents(5));
    sync.change(withEvents(1));
    await vi.advanceTimersByTimeAsync(SAVE_DELAY);

    expect(sync.getSnapshot()).toMatchObject({ saveState: "conflict", conflict: { version: 2, updatedBy: "Pat" } });
    expect(server.record?.data).toEqual(withEvents(5));

    // Recording on keeps going into the browser, but nothing is sent until the coach chooses.
    sync.change(withEvents(2));
    await vi.advanceTimersByTimeAsync(RETRY_DELAY * 2);
    expect(server.saves).toHaveLength(1);
    expect(readBackup(store, SET)?.data).toEqual(withEvents(2));

    sync.overwrite();
    await vi.advanceTimersByTimeAsync(0);

    expect(server.record).toEqual({ version: 3, data: withEvents(2) });
    expect(sync.getSnapshot().saveState).toBe("saved");
  });

  test("keep theirs drops this browser's copy and hands it back to download", async () => {
    const server = fakeServer({ version: 1, data: emptyData() });
    const store = memoryStore();
    const sync = new SetSync(SET, GAME, server.backend, store);

    await openReady(sync);
    server.saveElsewhere(withEvents(5));
    sync.change(withEvents(1));
    await vi.advanceTimersByTimeAsync(SAVE_DELAY);

    expect(sync.discardMine()).toEqual(withEvents(1));
    expect(readBackup(store, SET)).toBeNull();
    expect(await openReady(sync)).toEqual(withEvents(5));
  });

  test.each([
    { keepMine: true, data: withEvents(1), saved: { version: 3, data: withEvents(1) } },
    { keepMine: false, data: withEvents(7), saved: { version: 2, data: withEvents(7) } },
  ])(
    "reopening with a local copy of an older version asks whose to keep (keep mine: $keepMine)",
    async ({ keepMine, data, saved }) => {
      const server = fakeServer({ version: 2, data: withEvents(7) });
      const store = memoryStore();

      writeBackup(store, SET, { gameId: GAME, baseVersion: 1, data: withEvents(1) });

      const sync = new SetSync(SET, GAME, server.backend, store);
      const opened = await sync.open();

      if (opened.kind !== "choose") throw new Error(`expected a choice, got ${opened.kind}`);

      expect(opened.choice.mine).toEqual(withEvents(1));
      expect(opened.choice.theirs.version).toBe(2);
      expect(sync.resolveReopen(opened.choice, keepMine)).toEqual({ kind: "ready", data });

      await vi.advanceTimersByTimeAsync(0);
      expect(server.record).toEqual(saved);
      expect(readBackup(store, SET)).toBeNull();
    }
  );
});

describe("a newer server copy that is no one else's recording", () => {
  test("a save whose answer was lost is not a conflict: saving carries on from it", async () => {
    const server = fakeServer({ version: 1, data: emptyData() });
    const store = memoryStore();
    const sync = new SetSync(SET, GAME, server.backend, store);

    await openReady(sync);
    server.loseAnswer();
    sync.change(withEvents(1));
    await vi.advanceTimersByTimeAsync(SAVE_DELAY);

    expect(sync.getSnapshot().saveState).toBe("offline");

    sync.change(withEvents(2));
    await vi.advanceTimersByTimeAsync(RETRY_DELAY);

    expect(sync.getSnapshot()).toMatchObject({ saveState: "saved", conflict: null });
    expect(server.record).toEqual({ version: 3, data: withEvents(2) });
    expect(readBackup(store, SET)).toBeNull();
  });

  test("a change to only the set's teams, date, or player list does not stop the recording", async () => {
    const server = fakeServer({ version: 1, data: withEvents(1) });
    const sync = new SetSync(SET, GAME, server.backend, memoryStore());
    const data = await openReady(sync);

    server.saveElsewhere({ ...data, players: ["Mira", "Jo"], meta: { ...data.meta, awayTeam: "Opal" } });
    sync.change(withEvents(2));
    await vi.advanceTimersByTimeAsync(SAVE_DELAY);

    expect(sync.getSnapshot()).toMatchObject({ saveState: "saved", conflict: null });
    expect(server.record).toEqual({ version: 3, data: withEvents(2) });
  });

  test("a save leaves the local copy when another tab has put newer changes in it", async () => {
    const server = fakeServer({ version: 1, data: emptyData() });
    const store = memoryStore();
    const sync = new SetSync(SET, GAME, server.backend, store);

    await openReady(sync);
    sync.change(withEvents(1));

    const release = server.hold();
    const saving = sync.save();

    writeBackup(store, SET, { gameId: GAME, baseVersion: 1, data: withEvents(5) });
    release();
    await saving;

    expect(readBackup(store, SET)?.data).toEqual(withEvents(5));
  });
});

describe("the local copy", () => {
  test("carries the set's game, so the set can reopen before anything loads from the server", async () => {
    const server = fakeServer({ version: 1, data: emptyData() });
    const store = memoryStore();
    const context = { game: GAME_DATA, teamName: "Eagles" };
    const sync = new SetSync(SET, GAME, server.backend, store, context);

    await openReady(sync);
    sync.change(withEvents(1));

    expect(readBackup(store, SET)?.context).toEqual(context);
  });
});

describe("the set's stats", () => {
  test("a recorded change reaches the stats only once they are saved", async () => {
    const server = fakeServer({ version: 1, data: emptyData(["Mira"]), published: emptyData(["Mira"]) });
    const sync = new SetSync(SET, GAME, server.backend, memoryStore());

    await openReady(sync);

    expect(sync.getSnapshot().stats).toBe("saved");

    sync.change(withEvents(1));
    await vi.advanceTimersByTimeAsync(SAVE_DELAY);

    expect(server.record).toMatchObject({ version: 2, data: withEvents(1), published: emptyData(["Mira"]) });
    expect(sync.getSnapshot()).toMatchObject({ saveState: "saved", stats: "changed" });

    expect(await sync.publish()).toBeNull();
    expect(server.record?.published).toEqual(withEvents(1));
    expect(sync.getSnapshot().stats).toBe("saved");
  });

  test("saving the stats saves the set first, so the latest change is in them", async () => {
    const server = fakeServer({ version: 1, data: emptyData(["Mira"]), published: null });
    const sync = new SetSync(SET, GAME, server.backend, memoryStore());

    await openReady(sync);

    expect(sync.getSnapshot().stats).toBe("changed");

    sync.change(withEvents(2));

    expect(await sync.publish()).toBeNull();
    expect(server.record).toMatchObject({ version: 2, published: withEvents(2) });
  });

  test("the teams and date, which follow the game, do not count as a change to the stats", async () => {
    const published = { ...emptyData(["Mira"]), meta: { ...emptyData().meta, homeTeam: "Old name" } };
    const sync = new SetSync(SET, GAME, fakeServer({ version: 1, data: published, published }).backend, memoryStore());

    await openReady(sync);
    sync.change({ ...published, meta: { ...published.meta, homeTeam: "Eagles", date: "2026-10-31" } });

    expect(sync.getSnapshot().stats).toBe("saved");
  });

  test("offline, or after someone else saved, the stats stay as they were and the coach is told why", async () => {
    const server = fakeServer({ version: 1, data: emptyData(["Mira"]), published: null });
    const sync = new SetSync(SET, GAME, server.backend, memoryStore());

    await openReady(sync);
    server.setMode("offline");

    expect(await sync.publish()).toMatch(/^Couldn’t reach the server/);

    server.setMode("online");
    server.saveElsewhere(withEvents(3));

    expect(await sync.publish()).toBe("Pat changed this set just now, so its stats weren’t saved. Try again.");
    expect(server.record?.published).toBeNull();
    expect(sync.getSnapshot().stats).toBe("changed");
  });
});
