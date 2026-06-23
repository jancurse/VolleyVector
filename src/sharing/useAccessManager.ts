import { useEffect, useState } from "react";

import type { AccessRow, Capability } from "../supabase/rows";
import type { TeamRef } from "../workspace/useWorkspace";
import { fetchAccess } from "./access";
import type { AccessData, Profile } from "./access";
import { fetchShareCandidates } from "./candidates";
import type { ShareCandidate } from "./candidates";

// The shared scaffold behind the board and note access managers: the grants/profiles/candidates state, the
// open-effect that loads them, and the optimistic re-fetch after a write. The two managers differ only in
// which access table they read, how a write keys back to it, and the outside-team link/email fns, so all of
// that comes through the adapter. fetchAccess already parameterizes the table; this extends that pattern to
// the whole dialog scaffold.
type AccessManagerAdapter = {
  table: "board_access" | "topic_access";
  idColumn: "board_id" | "topic_id";
  id: string;
  add: (kind: "user" | "team", principalId: string, capability: Capability) => Write;
  changeCapability: (grant: AccessRow, capability: Capability) => Write;
  remove: (grant: AccessRow) => Write;
  createLink: (capability: Capability) => Promise<{ url: string | null; error: string | null }>;
  grantByEmail: (email: string, capability: Capability) => Promise<{ error: string | null }>;
};

type Write = PromiseLike<{ error: { message: string } | null }>;

export type AccessManagerState = {
  grants: AccessRow[];
  profiles: Map<string, Profile>;
  candidates: ShareCandidate[];
  error: string | null;
  loading: boolean;
  onAdd: (kind: "user" | "team", principalId: string, capability: Capability) => void;
  onChangeCapability: (grant: AccessRow, capability: Capability) => void;
  onRemove: (grant: AccessRow) => void;
  onCreateLink: (capability: Capability) => Promise<{ url: string | null; error: string | null }>;
  onGrantByEmail: (email: string, capability: Capability) => Promise<{ error: string | null }>;
};

export function useAccessManager(
  open: boolean,
  adapter: AccessManagerAdapter,
  memberTeams: readonly TeamRef[],
  currentUserId: string
): AccessManagerState {
  const { table, idColumn, id } = adapter;
  const [grants, setGrants] = useState<AccessRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [candidates, setCandidates] = useState<ShareCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const apply = (data: AccessData) => {
    setError(data.error);
    setGrants(data.grants);
    setProfiles(data.profiles);
  };

  useEffect(() => {
    if (!open) return;

    let active = true;

    void (async () => {
      setLoading(true);

      const data = await fetchAccess(table, idColumn, id);

      if (!active) return;

      apply(data);
      setLoading(false);
    })();
    void fetchShareCandidates(memberTeams, currentUserId).then((r) => {
      if (!active) return;

      setCandidates(r.candidates);
      // Surface a memberships/profiles load failure without clobbering a concurrent access-fetch error.
      if (r.error) setError(r.error);
    });

    return () => {
      active = false;
    };
  }, [open, table, idColumn, id, memberTeams, currentUserId]);

  const run = async (op: Write) => {
    const { error: writeError } = await op;

    if (writeError) setError(writeError.message);
    else apply(await fetchAccess(table, idColumn, id));
  };

  return {
    grants,
    profiles,
    candidates,
    error,
    loading,
    onAdd: (kind, principalId, capability) => void run(adapter.add(kind, principalId, capability)),
    onChangeCapability: (grant, capability) => void run(adapter.changeCapability(grant, capability)),
    onRemove: (grant) => void run(adapter.remove(grant)),
    onCreateLink: adapter.createLink,
    onGrantByEmail: adapter.grantByEmail,
  };
}
