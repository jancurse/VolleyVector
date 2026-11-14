import { supabase } from "../supabase/client";
import { deriveRallies } from "./rallies";
import { readBackup } from "./sync/setSync";
import type { LoadOutcome, SaveOutcome, SaveRequest, SetBackend } from "./sync/setSync";
import { SET_SUMMARY_COLUMNS, setRecordFromRow, setSummaryFromRow } from "../supabase/rows";
import type { GameSetRow, SetSummaryRow } from "../supabase/rows";
import type { AppData, SetSummary } from "./types";

// The recorded sets in Supabase: the summaries the games list shows, the full sets the stats read, and
// the backend the tracker's saving runs on. Writes go through the save_game_set compare-and-swap.

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

/** Every set of the given games, games in the order given and sets in set order. */
export async function loadGameSets(gameIds: readonly string[]): Promise<{ sets: AppData[]; error: string | null }> {
  const { data, error } = await supabase.from("game_sets").select("game_id, set_number, data").in("game_id", gameIds);

  if (error) return { sets: [], error: error.message };

  const rows = (data ?? []) as { game_id: string; set_number: number; data: AppData }[];

  return {
    sets: [...rows]
      .sort((a, b) => gameIds.indexOf(a.game_id) - gameIds.indexOf(b.game_id) || a.set_number - b.set_number)
      .map((r) => r.data),
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

/**
 * Apply `change` to every stored set of the given games and save the ones it changes, each as a compare-and-swap
 * on the version it was read at: a set saved in between is read again and changed again, never overwritten.
 * `change` returns an error instead to leave a set alone.
 */
export async function updateSets(
  gameIds: readonly string[],
  change: (data: AppData, gameId: string) => AppData | { error: string },
  backend: SetBackend = supabaseSetBackend
): Promise<SetUpdate> {
  const result: SetUpdate = { updated: 0, skipped: 0, error: null };

  if (gameIds.length === 0) return result;

  const { data, error } = await supabase.from("game_sets").select("id, game_id, version, data").in("game_id", gameIds);

  if (error) return { ...result, error: error.message };

  const errors: string[] = [];

  for (const row of (data ?? []) as GameSetRow[]) {
    let record = setRecordFromRow(row);

    for (let attempt = 1; ; attempt++) {
      const next = change(record.data, record.gameId);

      if ("error" in next) {
        errors.push(next.error);
        break;
      }
      if (JSON.stringify(next) === JSON.stringify(record.data)) break;
      if (readBackup(localStorage, row.id)) {
        result.skipped++;
        break;
      }

      const saved = await backend.save({ id: record.id, gameId: record.gameId, data: next, base: record.version });

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

/** The stored sets of one game, with their ids. */
export async function loadSetData(
  gameId: string
): Promise<{ sets: { id: string; data: AppData }[]; error: string | null }> {
  const { data, error } = await supabase.from("game_sets").select("id, data").eq("game_id", gameId);

  return { sets: (data ?? []) as { id: string; data: AppData }[], error: error?.message ?? null };
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
 * Save straight to the server, for imported sets: they are complete, so version 0. The caller mints `id` and
 * passes it again to retry, which then never makes a second set.
 */
export async function createSet(gameId: string, data: AppData, id: string): Promise<SaveOutcome> {
  return supabaseSetBackend.save({ id, gameId, data, base: 0 });
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
};

async function loadSet(id: string): Promise<LoadOutcome> {
  if (!(await signedIn())) return { kind: "signedOut" };

  const { data, error } = await supabase
    .from("game_sets")
    .select("id, game_id, version, data")
    .eq("id", id)
    .maybeSingle();

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

  const score = deriveRallies(data.events, data.meta).at(-1)?.score ?? { us: 0, them: 0 };
  const { data: res, error } = await supabase.rpc("save_game_set", {
    set_id: id,
    game: gameId,
    content: data,
    base,
    us: score.us,
    them: score.them,
  });

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

  return { kind: "saved", version: r.version ?? base + 1 };
}
