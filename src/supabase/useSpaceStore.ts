import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { User } from "@supabase/supabase-js";

import { supabase } from "./client";
import { writeWithRetries } from "./retry";
import type { Capability } from "./rows";
import type { TeamRole } from "../workspace/useWorkspace";
import type { Space } from "../workspace/space";

type ReadResult<Row> = { data: Row[] | null; error: { message: string } | null };

type SpaceStoreConfig<Row, Item> = {
  space: Space | null;
  isAdmin: boolean;
  activeRole: TeamRole | null;
  user: User | null;
  /** Read one space's rows, by the space's principal on the access list (a team's grants by team, the
   *  personal space's by the user). Grace-archived rows are hidden from every normal view. */
  read: (space: Space, userId: string) => PromiseLike<ReadResult<Row>>;
  /** Map loaded rows to the client model, deriving each item's capability from the space's grant. */
  map: (rows: Row[], capabilityOf: (grant: Capability | undefined) => Capability) => Item[];
};

export type SpaceStore<Item> = {
  items: Item[];
  setItems: Dispatch<SetStateAction<Item[]>>;
  loading: boolean;
  error: string | null;
  setError: (message: string | null) => void;
  /** Refetch the space's rows and replace the list, leaving loading/error untouched (a reconciliation). */
  refetch: () => Promise<void>;
  /** Record an error and refetch to reconcile the optimistic list against the server. */
  fail: (message: string) => void;
};

/** The scaffolding both space-scoped stores share: the list/loading/error state, the viewer's derived
 *  capability, the mount-fetch effect (an async IIFE, never a synchronous setState-in-effect), the refetch,
 *  and the error-then-refetch reconciliation. The viewer's `capability` is derived from the space's grant and
 *  their role: an admin is owner everywhere, a coach gets the team grant's capability, anyone else a team
 *  grant reads as viewer, and a direct user grant counts as itself. */
export function useSpaceStore<Row, Item>(config: SpaceStoreConfig<Row, Item>): SpaceStore<Item> {
  const { space, isAdmin, activeRole, user, read, map } = config;

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const capabilityOf = useCallback(
    (grant: Capability | undefined): Capability => {
      if (isAdmin) return "owner";
      if (!grant) return "viewer";
      if (space?.kind === "team") return activeRole === "coach" ? grant : "viewer";

      return grant;
    },
    [isAdmin, activeRole, space]
  );

  const mapRows = useCallback((rows: Row[]): Item[] => map(rows, capabilityOf), [map, capabilityOf]);

  const refetch = useCallback(async () => {
    if (!space || !user) return;

    const { data, error: queryError } = await read(space, user.id);

    if (!queryError && data) setItems(mapRows(data));
  }, [space, user, read, mapRows]);

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!space || !user) {
        setItems([]);
        setLoading(false);

        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: queryError } = await read(space, user.id);

      if (!active) return;

      if (queryError) {
        setError(queryError.message);
        setLoading(false);

        return;
      }

      setItems(mapRows(data ?? []));
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [space, user, read, mapRows]);

  const fail = useCallback(
    (message: string) => {
      setError(message);
      void refetch();
    },
    [refetch]
  );

  return { items, setItems, loading, error, setError, refetch, fail };
}

/** Insert the creator's owner grant after the row landed, retrying transient failures and counting a
 *  duplicate key (this create's own earlier attempt) a success. If the grant never lands, the row is
 *  orphaned (the access list is empty, so nothing can ever read or delete it through RLS): fire the
 *  admin-only orphan-cleanup RPC so a failed create leaves nothing behind. Resolves null on success, or the
 *  error message. */
export async function insertOwnerGrant(
  accessTable: "board_access" | "topic_access",
  grant: Record<string, unknown>,
  orphanCleanup: { rpc: "delete_orphan_board" | "delete_orphan_topic"; args: Record<string, unknown> }
): Promise<string | null> {
  const grantError = await writeWithRetries(async () => {
    const result = await supabase.from(accessTable).insert(grant);

    return result.error?.code === "23505" ? { error: null } : result;
  });

  if (grantError !== null) await supabase.rpc(orphanCleanup.rpc, orphanCleanup.args);

  return grantError;
}
