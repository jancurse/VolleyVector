import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { supabase } from "../../supabase/client";
import { download } from "../../bundle/download";
import type { AppData } from "../types";
import { SetSync, writeBackup } from "./setSync";
import type { BackupStore, Opened, ReopenChoice, SetBackend, SetContext, SyncSnapshot } from "./setSync";

/** Start a set in this browser: its local copy exists before anything reaches the server. */
export function startSet(context: SetContext, data: AppData, store: BackupStore = localStorage): string {
  const id = crypto.randomUUID();

  writeBackup(store, id, { gameId: context.game.id, context, baseVersion: 0, data });

  return id;
}

const fileName = (data: AppData, id: string, which: string): string =>
  `${which}_set_${data.meta.setNumber || "x"}_${id.slice(0, 8)}.json`;

/** Download a copy of a set's data before it is discarded. */
export const downloadSet = (data: AppData, id: string, which: string): void =>
  download(JSON.stringify(data, null, 2), fileName(data, id, which), "application/json");

/**
 * One set's saving, bound to the page: it saves when the tab is hidden, when the connection or a sign-in
 * comes back, and warns before leaving with changes the server does not have yet.
 */
export function useSetSync(
  id: string,
  context: SetContext,
  backend: SetBackend,
  store: BackupStore = localStorage
): {
  opened: Opened | null;
  snapshot: SyncSnapshot;
  onChange: (data: AppData) => void;
  resolveReopen: (choice: ReopenChoice, keepMine: boolean) => void;
  overwrite: () => void;
  discardMine: () => void;
  retry: () => void;
  flush: () => Promise<boolean>;
  /** Save the set's stats; resolves to why it failed, or null. */
  publish: () => Promise<string | null>;
  reload: () => void;
} {
  const [sync] = useState(() => new SetSync(id, context.game.id, backend, store, context));
  const [opened, setOpened] = useState<Opened | null>(null);
  const [attempt, setAttempt] = useState(0);
  const snapshot = useSyncExternalStore(sync.subscribe, sync.getSnapshot);

  useEffect(() => {
    let active = true;

    void sync.open().then((result) => active && setOpened(result));

    return () => {
      active = false;
    };
  }, [sync, attempt]);

  useEffect(() => () => sync.dispose(), [sync]);

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && sync.nudge();
    const onOnline = () => sync.nudge();
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!sync.pending) return;

      sync.nudge();
      e.preventDefault();
    };
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") sync.nudge();
    });

    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("online", onOnline);
    window.addEventListener("beforeunload", beforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeunload", beforeUnload);
      data.subscription.unsubscribe();
    };
  }, [sync]);

  const resolveReopen = useCallback(
    (choice: ReopenChoice, keepMine: boolean) => {
      downloadSet(keepMine ? choice.theirs.data : choice.mine, id, keepMine ? "replaced" : "discarded");
      setOpened(sync.resolveReopen(choice, keepMine));
    },
    [sync, id]
  );

  const discardMine = useCallback(() => {
    const mine = sync.discardMine();

    if (mine) downloadSet(mine, id, "discarded");
    setOpened(null);
    setAttempt((n) => n + 1);
  }, [sync, id]);

  return {
    opened,
    snapshot,
    onChange: useCallback((data: AppData) => sync.change(data), [sync]),
    resolveReopen,
    overwrite: useCallback(() => sync.overwrite(), [sync]),
    discardMine,
    retry: useCallback(() => sync.retry(), [sync]),
    flush: useCallback(() => sync.flush(), [sync]),
    publish: useCallback(() => sync.publish(), [sync]),
    reload: useCallback(() => {
      setOpened(null);
      setAttempt((n) => n + 1);
    }, []),
  };
}
