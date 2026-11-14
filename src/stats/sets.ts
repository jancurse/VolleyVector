import { supabase } from "../supabase/client";
import { deriveRallies } from "./rallies";
import { readBackup } from "./sync/setSync";
import type { LoadOutcome, PublishRequest, SaveOutcome, SaveRequest, SetBackend } from "./sync/setSync";
import { SET_SUMMARY_COLUMNS, setRecordFromRow, setSummaryFromRow } from "../supabase/rows";
import type { GameSetRow, SetSummaryRow } from "../supabase/rows";
import type { AppData, SetSummary } from "./types";

// The recorded sets in Supabase: the summaries the games list shows and the saved stats the stats pages read, which
// any team member may read, and the working copies only a coach reads (through working_game_set(s)). The tracker
// saves a set's working copy through the save_game_set compare-and-swap and makes it the stats with
// publish_game_set; changes that follow the game go through relink_game_set.

const bySetNumber = (a: { setNumber: number }, b: { setNumber: number }): number => a.setNumber - b.setNumber;

export async function listSetSummaries(
  gameIds: readonly string[]
): Promise<{ sets: SetSummary[]; error: string | null }> {
  if (gameIds.length === 0) return { sets: [], error: null };

  const { data, error } = await supabase.from("game_sets").select(SET_SUMMARY_COLUMNS).in("game_id", gameIds);

  return {
    sets: ((data ?? []) as unknown as SetSummaryRow[]).map(setSummaryFromRow).sort(bySetNumber),
    error: error?.message ?? null,
  };
}

/**
 * The saved stats of every set of the given games that has them, games in the order given and sets in set order.
 * Their teams and date may be out of date: the game's are the ones to show.
 */
export async function loadGameSets(
  gameIds: readonly string[]
): Promise<{ sets: { gameId: string; data: AppData }[]; error: string | null }> {
  const { data, error } = await supabase
    .from("game_sets")
    .select("game_id, published")
    .in("game_id", gameIds)
    .not("published", "is", null);

  if (error) return { sets: [], error: error.message };

  const rows = (data ?? []) as { game_id: string; published: AppData }[];

  return {
    sets: [...rows]
      .sort(
        (a, b) =>
          gameIds.indexOf(a.game_id) - gameIds.indexOf(b.game_id) || setNumberOf(a.published) - setNumberOf(b.published)
      )
      .map((r) => ({ gameId: r.game_id, data: r.published })),
    error: null,
  };
}

export type SetUpdate = {
  updated: number;
  /** Sets with changes in this browser not saved yet: left alone, and brought in line when next opened here. */
  skipped: number;
  error: string | null;
};

/** How many times a set that someone else saved in between is reloaded and changed again. */
const UPDATE_ATTEMPTS = 3;

export type RelinkRequest = { id: string; data: AppData; published: AppData | null; base: number };

/** What `updateSets` saves through: it changes both copies of a set, its working copy and its stats. */
export type RelinkBackend = Pick<SetBackend, "load"> & { relink: (request: RelinkRequest) => Promise<SaveOutcome> };

const setNumberOf = (data: AppData): number => parseInt(data.meta.setNumber, 10) || 0;

const same = (a: AppData | null | undefined, b: AppData | null | undefined): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Apply `change` to both copies of every stored set of the given games (its working copy and its saved stats) and
 * save the sets it changes, each as a compare-and-swap on the version it was read at: a set saved in between is
 * read again and changed again, never overwritten. `change` returns an error instead to leave a set alone. For
 * changes that follow the game or the roster, never for the recording itself.
 */
export async function updateSets(
  gameIds: readonly string[],
  change: (data: AppData, gameId: string) => AppData | { error: string },
  backend: RelinkBackend = supabaseRelinkBackend
): Promise<SetUpdate> {
  const result: SetUpdate = { updated: 0, skipped: 0, error: null };

  if (gameIds.length === 0) return result;

  const { data, error } = await supabase.rpc("working_game_sets", { game_ids: gameIds });

  if (error) return { ...result, error: error.message };

  const errors: string[] = [];

  for (const row of (data ?? []) as GameSetRow[]) {
    let record = setRecordFromRow(row);

    for (let attempt = 1; ; attempt++) {
      const next = change(record.data, record.gameId);
      const published = record.published ? change(record.published, record.gameId) : null;

      if ("error" in next) {
        errors.push(next.error);
        break;
      }
      if (published && "error" in published) {
        errors.push(published.error);
        break;
      }
      if (same(next, record.data) && same(published, record.published)) break;
      if (readBackup(localStorage, row.id)) {
        result.skipped++;
        break;
      }

      const saved = await backend.relink({ id: record.id, data: next, published, base: record.version });

      if (saved.kind === "saved") {
        result.updated++;
        break;
      }
      if (saved.kind === "missing") break;

      const reloaded = saved.kind === "conflict" && attempt < UPDATE_ATTEMPTS ? await backend.load(record.id) : null;

      if (reloaded?.kind !== "found") {
        errors.push(
          `Set ${record.data.meta.setNumber || "?"} wasn’t updated (${"message" in saved ? saved.message : saved.kind}).`
        );
        break;
      }

      record = reloaded.record;
    }
  }

  return { ...result, error: errors.length ? [...new Set(errors)].join(" ") : null };
}

/** The working copies of one game's sets, with their ids; none unless the caller coaches the team. */
export async function loadSetData(
  gameId: string
): Promise<{ sets: { id: string; data: AppData }[]; error: string | null }> {
  const { data, error } = await supabase.rpc("working_game_sets", { game_ids: [gameId] });

  return {
    sets: ((data ?? []) as GameSetRow[]).map(({ id, data: set }) => ({ id, data: set })),
    error: error?.message ?? null,
  };
}

/** Delete a set. A delete the server's rules refuse removes nothing and reports no error, so the row is asked for. */
export async function deleteSet(id: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase.from("game_sets").delete().eq("id", id).select("id");

  return {
    error: error?.message ?? (data?.length ? null : "The set wasn’t deleted: it is gone, or not yours to delete."),
  };
}

export async function finishSet(id: string, finished: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("finish_game_set", { set_id: id, finished });

  return { error: error?.message ?? null };
}

/**
 * Save straight to the server with its stats, for imported sets: they are complete. The caller mints `id` and
 * passes it again to retry, which then never makes a second set.
 */
export async function importSet(gameId: string, data: AppData, id: string): Promise<SaveOutcome> {
  const created = await supabaseSetBackend.save({ id, gameId, data, base: 0 });

  return created.kind === "saved" ? supabaseSetBackend.publish({ id, base: created.version, data }) : created;
}

type PostgrestErrorLike = { code?: string; message: string };

const signedOutCodes = new Set(["PGRST301", "PGRST302", "PGRST303"]);

/** Sort a failed request into the outcomes the saving logic acts on. */
function failure(error: PostgrestErrorLike): Exclude<SaveOutcome, { kind: "saved" }> {
  if (error.code && signedOutCodes.has(error.code)) return { kind: "signedOut" };
  if (error.code === "42501") return { kind: "refused", message: "This account may not record sets for this team." };
  if (error.code === "22023") return { kind: "refused", message: `The server refused this set: ${error.message}` };

  return { kind: "offline", message: error.message || "Can’t reach the server." };
}

async function signedIn(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();

  return data.session !== null;
}

/** How long a load or save may take before it counts as offline. */
const REQUEST_TIMEOUT = 8000;

/**
 * `request`, or the offline outcome if it takes too long. Offline, the auth client can hold every request while it
 * retries a token refresh; recording must not wait on that.
 */
function timed<T>(request: Promise<T>, offline: T): Promise<T> {
  return Promise.race([request, new Promise<T>((resolve) => setTimeout(() => resolve(offline), REQUEST_TIMEOUT))]);
}

const timedOut = { kind: "offline", message: "The server took too long to answer." } as const;

type SaveResponse = {
  version?: number;
  conflict?: boolean;
  missing?: boolean;
  updated_by?: string;
  updated_at?: string;
};

export const supabaseSetBackend: SetBackend = {
  load: (id) => timed(loadSet(id), timedOut),
  save: (request) => timed(saveSet(request), timedOut),
  publish: (request) => timed(publishSet(request), timedOut),
};

const supabaseRelinkBackend: RelinkBackend = { load: supabaseSetBackend.load, relink: relinkSet };

async function loadSet(id: string): Promise<LoadOutcome> {
  if (!(await signedIn())) return { kind: "signedOut" };

  const { data, error } = await supabase.rpc("working_game_set", { set_id: id }).maybeSingle();

  if (error) {
    const f = failure(error);

    return f.kind === "signedOut" ? f : { kind: "offline", message: error.message };
  }

  if (!data) return { kind: "missing" };

  return { kind: "found", record: setRecordFromRow(data as GameSetRow) };
}

async function saveSet({ id, gameId, data, base }: SaveRequest): Promise<SaveOutcome> {
  // Signed out (in another tab, or the session lapsed): the request would go out anonymous and be refused,
  // which must not read as "not allowed". Keep the changes and wait for a sign-in instead.
  if (!(await signedIn())) return { kind: "signedOut" };

  const { data: res, error } = await supabase.rpc("save_game_set", { set_id: id, game: gameId, content: data, base });

  return answer(res, error, base + 1);
}

async function publishSet({ id, base, data }: PublishRequest): Promise<SaveOutcome> {
  if (!(await signedIn())) return { kind: "signedOut" };

  // The list shows the stats' score, which follows from the rally rules, so it is derived here.
  const score = deriveRallies(data.events, data.meta).at(-1)?.score ?? { us: 0, them: 0 };
  const { data: res, error } = await supabase.rpc("publish_game_set", {
    set_id: id,
    base,
    us: score.us,
    them: score.them,
  });

  return answer(res, error, base);
}

async function relinkSet({ id, data, published, base }: RelinkRequest): Promise<SaveOutcome> {
  if (!(await signedIn())) return { kind: "signedOut" };

  const { data: res, error } = await supabase.rpc("relink_game_set", {
    set_id: id,
    base,
    content: data,
    stats: published,
  });

  return answer(res, error, base + 1);
}

/** A set RPC's answer as an outcome; `version` is the one it saved when the answer leaves it out. */
function answer(res: unknown, error: PostgrestErrorLike | null, version: number): SaveOutcome {
  if (error) return failure(error);

  const r = res as SaveResponse;

  if (r.conflict)
    return {
      kind: "conflict",
      version: r.version ?? 0,
      updatedBy: r.updated_by ?? "Someone",
      updatedAt: r.updated_at ?? "",
    };
  if (r.missing) return { kind: "missing" };

  return { kind: "saved", version: r.version ?? version };
}
