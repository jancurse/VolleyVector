import type { Game } from "../../games/types";
import type { AppData } from "../types";

// Keeps a recorded set safe while it is tracked. Every change goes into this browser's storage first,
// together with the server version it was made on, and to the server a moment later; the local copy is
// cleared only once the server confirms it holds that exact data. Saves are a compare-and-swap on the
// version: if someone else saved in between, saving stops and the coach chooses whose changes to keep.
// What is saved this way is the set's working copy. Its stats, which everyone else reads, change only when the
// coach saves them (`publish`), which makes the working copy as the server holds it the stats.
// Nothing here depends on React or Supabase, so the rules are tested against a fake backend.

export type SaveState = "saved" | "saving" | "unsaved" | "offline" | "signedOut" | "conflict" | "refused";

export type Conflict = { version: number; updatedBy: string; updatedAt: string };

export type SetRecord = {
  id: string;
  gameId: string;
  version: number;
  data: AppData;
  /** The set's saved stats; null before they are first saved. */
  published?: AppData | null;
};

export type LoadOutcome =
  | { kind: "found"; record: SetRecord }
  | { kind: "missing" }
  | { kind: "signedOut" }
  | { kind: "offline"; message: string };

export type SaveRequest = { id: string; gameId: string; data: AppData; base: number };

/** Make the working copy at version `base`, which holds `data`, the set's stats. */
export type PublishRequest = { id: string; base: number; data: AppData };

export type SaveOutcome =
  | { kind: "saved"; version: number }
  | ({ kind: "conflict" } & Conflict)
  | { kind: "missing" }
  /** Not allowed or not valid: retrying the same request would fail the same way. */
  | { kind: "refused"; message: string }
  | { kind: "signedOut" }
  /** The network or the server is unavailable: retry. */
  | { kind: "offline"; message: string };

export type SetBackend = {
  load: (id: string) => Promise<LoadOutcome>;
  save: (request: SaveRequest) => Promise<SaveOutcome>;
  publish: (request: PublishRequest) => Promise<SaveOutcome>;
};

/** The browser storage the local copies live in (localStorage in the app). */
export type BackupStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The game a set belongs to, kept with its local copy so the set can reopen without the server. */
export type SetContext = {
  game: Game;
  teamName: string;
  /** Who is recording, so the copy only reopens for them. */
  userId?: string;
};

export type Backup = {
  gameId: string;
  context?: SetContext;
  /** The server version these changes were made on; 0 for a set the server has not seen yet. */
  baseVersion: number;
  data: AppData;
};

/** A local copy that disagrees with a newer server copy, waiting for the coach to pick one. */
export type ReopenChoice = { mine: AppData; theirs: SetRecord };

export type Opened =
  | { kind: "ready"; data: AppData }
  | { kind: "choose"; choice: ReopenChoice }
  | { kind: "missing"; backup: Backup | null }
  | { kind: "error"; message: string };

/** Whether the set's stats hold its latest changes: "changed" until the coach saves them. */
export type StatsState = "saved" | "changed" | "saving";

export type SyncSnapshot = {
  saveState: SaveState;
  stats: StatsState;
  conflict: Conflict | null;
  /** Why the last save failed, for the save status's detail. */
  error: string | null;
  /** True when this browser's storage refused the local copy (full or blocked). */
  storageFailed: boolean;
};

export const SAVE_DELAY = 1000;
export const RETRY_DELAY = 5000;

const backupKey = (id: string): string => `volleyvector:set:${id}`;

export function readBackup(store: BackupStore, id: string): Backup | null {
  try {
    const raw = store.getItem(backupKey(id));

    return raw ? (JSON.parse(raw) as Backup) : null;
  } catch {
    return null;
  }
}

/** Write (or with null, clear) a set's local copy. Returns false when the storage refused it. */
export function writeBackup(store: BackupStore, id: string, backup: Backup | null): boolean {
  try {
    if (backup) store.setItem(backupKey(id), JSON.stringify(backup));
    else store.removeItem(backupKey(id));

    return true;
  } catch {
    return false;
  }
}

const sameData = (a: AppData, b: AppData): boolean => JSON.stringify(a) === JSON.stringify(b);

/** What the tracker records: everything but the player list, teams, and date, which follow the game. */
const recorded = ({ events, meta }: AppData): string =>
  JSON.stringify({ events, meta: { ...meta, homeTeam: "", awayTeam: "", date: "" } });

/** Everything the stats show of a set but the teams and date, which are read from the game. */
const statsOf = ({ players, events, meta }: AppData): string =>
  JSON.stringify({ players, events, meta: { ...meta, homeTeam: "", awayTeam: "", date: "" } });

export class SetSync {
  private version = 0;
  private latest: AppData | null = null;
  /** The data the server last confirmed it holds. */
  private confirmed: AppData | null = null;
  /** The data of a save that got no answer, so it may have reached the server. */
  private unconfirmed: AppData | null = null;
  /** The set's saved stats, as last loaded or saved; null when there are none or they are not known. */
  private published: AppData | null = null;
  private dirty = false;
  private inFlight: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** Set by a conflict or a refusal: no save until the coach resolves it. */
  private blocked = false;
  private snapshot: SyncSnapshot = {
    saveState: "saved",
    stats: "changed",
    conflict: null,
    error: null,
    storageFailed: false,
  };
  private listeners = new Set<() => void>();

  constructor(
    readonly id: string,
    readonly gameId: string,
    private backend: SetBackend,
    private store: BackupStore,
    private context?: SetContext
  ) {}

  /** Load the set, restoring any local copy that never reached the server. */
  async open(): Promise<Opened> {
    clearTimeout(this.timer);
    this.blocked = false;
    this.dirty = false;
    this.latest = null;
    this.confirmed = null;
    this.unconfirmed = null;
    this.published = null;
    this.set({ saveState: "saved", conflict: null, error: null });

    const backup = readBackup(this.store, this.id);
    const loaded = await this.backend.load(this.id);

    if (loaded.kind === "found") {
      const { record } = loaded;

      this.version = record.version;
      this.confirmed = record.data;
      this.published = record.published ?? null;

      if (!backup || sameData(backup.data, record.data)) {
        if (backup) writeBackup(this.store, this.id, null);

        return this.ready(record.data, false);
      }

      if (backup.baseVersion === record.version) return this.ready(backup.data, true);

      return { kind: "choose", choice: { mine: backup.data, theirs: record } };
    }

    if (loaded.kind === "missing") {
      // A set started in this browser that never reached the server: its first save creates it.
      if (backup?.baseVersion === 0) {
        this.version = 0;

        return this.ready(backup.data, true);
      }

      return { kind: "missing", backup };
    }

    // Offline or signed out: carry on from the local copy, if there is one, and save once possible.
    if (backup) {
      this.version = backup.baseVersion;

      const opened = this.ready(backup.data, true);

      this.fail(loaded);

      return opened;
    }

    return {
      kind: "error",
      message: loaded.kind === "signedOut" ? "You are signed out. Sign in to open this set." : loaded.message,
    };
  }

  /** Settle a reopen choice: keep this browser's copy (saving it over theirs) or the server's. */
  resolveReopen(choice: ReopenChoice, keepMine: boolean): Opened {
    this.version = choice.theirs.version;
    this.confirmed = choice.theirs.data;
    this.published = choice.theirs.published ?? null;

    if (keepMine) return this.ready(choice.mine, true);

    writeBackup(this.store, this.id, null);

    return this.ready(choice.theirs.data, false);
  }

  private ready(data: AppData, dirty: boolean): Opened {
    this.latest = data;
    this.dirty = dirty;
    this.compareStats();

    if (dirty) {
      this.keep(data);
      this.set({ saveState: "unsaved" });
      this.schedule(0);
    }

    return { kind: "ready", data };
  }

  /** The tracker's data changed: keep it locally at once, and save it shortly. */
  change(data: AppData): void {
    if (data === this.latest) return;

    // Only the teams or date differ (the tracker showing the game's): nothing to save.
    if (this.latest && statsOf(data) === statsOf(this.latest)) {
      this.latest = data;

      return;
    }

    this.latest = data;
    this.dirty = true;
    this.keep(data);
    this.compareStats();

    if (this.blocked) return;

    if (this.snapshot.saveState === "saved" || this.snapshot.saveState === "saving") this.set({ saveState: "unsaved" });
    this.schedule(SAVE_DELAY);
  }

  private keep(data: AppData): void {
    const ok = writeBackup(this.store, this.id, {
      gameId: this.gameId,
      context: this.context,
      baseVersion: this.version,
      data,
    });

    if (ok !== !this.snapshot.storageFailed) this.set({ storageFailed: !ok });
  }

  private schedule(delay: number): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.save(), delay);
  }

  /** Save now, if anything is waiting. Resolves once this save (and any already running) settles. */
  async save(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;

    if (this.inFlight) return this.inFlight;
    if (this.blocked || !this.dirty || !this.latest) return;

    this.inFlight = this.send(this.latest).finally(() => {
      this.inFlight = null;
    });

    await this.inFlight;

    // Changes made while that save was in flight are still to go.
    if (this.dirty && !this.blocked && !this.timer) this.schedule(SAVE_DELAY);
  }

  private async send(data: AppData): Promise<void> {
    this.dirty = false;
    this.set({ saveState: "saving" });

    let outcome: SaveOutcome;

    try {
      outcome = await this.backend.save({ id: this.id, gameId: this.gameId, data, base: this.version });
    } catch (e) {
      outcome = { kind: "offline", message: e instanceof Error ? e.message : String(e) };
    }

    if (outcome.kind === "saved") {
      this.version = outcome.version;
      this.confirmed = data;
      this.unconfirmed = null;

      // The local copy goes only when the server holds exactly what it holds (another tab on this set may have
      // written its own changes there); newer edits re-base on the new version.
      if (this.dirty && this.latest) this.keep(this.latest);
      else if (sameData(readBackup(this.store, this.id)?.data ?? data, data)) writeBackup(this.store, this.id, null);

      this.set({ saveState: this.dirty ? "unsaved" : "saved", error: null, conflict: null });

      return;
    }

    this.dirty = true;
    if (outcome.kind === "offline") this.unconfirmed = data;
    if (outcome.kind === "conflict" && (await this.rebased())) return this.send(this.latest ?? data);
    this.fail(outcome);
  }

  /**
   * After a conflict: true when the newer server copy is no one else's recording, so saving carries on from its
   * version. That is an earlier save of this set whose answer was lost, or a change to only what follows the game
   * (the player list, teams, and date).
   */
  private async rebased(): Promise<boolean> {
    const theirs = await this.backend.load(this.id).catch(() => null);

    if (theirs?.kind !== "found") return false;

    const { data, version } = theirs.record;

    // Already saving from this version: the server refuses it all the same, so the coach decides.
    if (version === this.version) return false;

    const ours =
      (this.unconfirmed && sameData(data, this.unconfirmed)) ||
      (this.confirmed && recorded(data) === recorded(this.confirmed));

    if (ours) {
      this.version = version;
      this.published = theirs.record.published ?? null;
      this.compareStats();
    }

    return !!ours;
  }

  private fail(outcome: Exclude<SaveOutcome, { kind: "saved" }>): void {
    switch (outcome.kind) {
      case "conflict": {
        const { version, updatedBy, updatedAt } = outcome;

        this.blocked = true;
        this.set({ saveState: "conflict", conflict: { version, updatedBy, updatedAt } });
        break;
      }
      case "missing":
        this.blocked = true;
        this.set({
          saveState: "refused",
          error: "This set was deleted from the game. Your copy is kept in this browser.",
        });
        break;
      case "refused":
        this.blocked = true;
        this.set({ saveState: "refused", error: outcome.message });
        break;
      case "signedOut":
        this.set({ saveState: "signedOut", error: null });
        this.schedule(RETRY_DELAY);
        break;
      case "offline":
        this.set({ saveState: "offline", error: outcome.message });
        this.schedule(RETRY_DELAY);
        break;
    }
  }

  private compareStats(): void {
    if (this.snapshot.stats === "saving") return;

    const same = this.published && this.latest && statsOf(this.published) === statsOf(this.latest);

    this.set({ stats: same ? "saved" : "changed" });
  }

  /**
   * Save the set's stats: save the working copy, then make it the stats. Resolves to why it failed, or null.
   * Changes made while it runs are saved as usual and wait for the next time.
   */
  async publish(): Promise<string | null> {
    if (this.snapshot.stats === "saving") return null;

    this.set({ stats: "saving" });

    const failed = (message: string) => {
      this.set({ stats: "changed" });
      this.compareStats();

      return message;
    };

    if (!(await this.flush()) || !this.confirmed)
      return failed("The set isn’t saved yet, so its stats weren’t either. Check your connection and try again.");

    const data = this.confirmed;
    let outcome: SaveOutcome;

    try {
      outcome = await this.backend.publish({ id: this.id, base: this.version, data });
    } catch (e) {
      outcome = { kind: "offline", message: e instanceof Error ? e.message : String(e) };
    }

    if (outcome.kind !== "saved")
      return failed(
        outcome.kind === "conflict"
          ? `${outcome.updatedBy} changed this set just now, so its stats weren’t saved. Try again.`
          : outcome.kind === "missing"
            ? "This set was deleted from the game."
            : outcome.kind === "refused"
              ? outcome.message
              : outcome.kind === "signedOut"
                ? "You are signed out. Sign in to save the stats."
                : `Couldn’t reach the server: ${outcome.message}`
      );

    this.published = data;
    this.set({ stats: "changed" });
    this.compareStats();

    return null;
  }

  /** Resolve a save conflict by saving this browser's copy over theirs. */
  overwrite(): void {
    const { conflict } = this.snapshot;

    if (!conflict) return;

    this.version = conflict.version;
    this.blocked = false;
    this.dirty = true;
    if (this.latest) this.keep(this.latest);
    this.set({ saveState: "unsaved", conflict: null });
    void this.save();
  }

  /** Drop this browser's copy (after a conflict), so the next open loads the server's. */
  discardMine(): AppData | null {
    this.blocked = true;
    this.dirty = false;
    clearTimeout(this.timer);
    writeBackup(this.store, this.id, null);

    return this.latest;
  }

  /** Try again after a refusal that may have been fixed (e.g. signing in as a coach). */
  retry(): void {
    if (this.snapshot.saveState === "conflict") return;

    this.blocked = false;
    void this.save();
  }

  /** Save at once if anything is waiting (the tab hidden, the connection back, signed in again). */
  nudge(): void {
    if (this.dirty && !this.blocked) void this.save();
  }

  /** True while a change has not reached the server. */
  get pending(): boolean {
    return this.dirty || this.inFlight !== null;
  }

  /** Save now and wait for it; true when the server has everything. */
  async flush(): Promise<boolean> {
    await this.save();

    return !this.pending;
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.listeners.clear();
  }

  getSnapshot = (): SyncSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);

    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<SyncSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l();
  }
}
