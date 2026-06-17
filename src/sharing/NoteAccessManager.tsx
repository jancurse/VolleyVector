import { useEffect, useState } from "react";
import type { JSX } from "react";

import { supabase } from "../supabase/client";
import type { AccessRow, Capability } from "../supabase/rows";
import { subtreeIds } from "../notes/operations";
import type { Note } from "../notes/types";
import { Dialog } from "../ui/Dialog";
import { MUTED } from "../ui/styles";
import type { TeamRef } from "../workspace/useWorkspace";
import { AccessList } from "./AccessList";
import { fetchAccess } from "./access";
import type { AccessData, Profile } from "./access";
import { fetchShareCandidates } from "./candidates";
import type { ShareCandidate } from "./candidates";
import { createTopicGrantLink, grantTopicByEmail } from "./grants";

// The owner's access manager for one note, sharing its whole subtree at once. A note is a document and a tree
// node; sharing applies to the note and every subnote beneath it, so a grant is written per node (reads stay
// non-recursive) and surfaces the subtree at the target team's top level. Add a teammate or a team you coach,
// change a grant's capability, remove a grant, or leave. RLS enforces the same rules server-side.
type NoteAccessManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The root note whose subtree is shared. */
  note: Note;
  /** The full note tree, to resolve the root's subtree. */
  notes: readonly Note[];
  /** Teams the caller may grant to (the teams they coach). */
  coachedTeams: readonly TeamRef[];
  /** Teams the caller belongs to, scoping the add-a-person picker to their teammates. */
  memberTeams: readonly TeamRef[];
  /** Resolve any team's name (a grant may name a team the caller does not coach). */
  teamName: (teamId: string) => string;
  currentUserId: string;
};

export function NoteAccessManager({
  open,
  onOpenChange,
  note,
  notes,
  coachedTeams,
  memberTeams,
  teamName,
  currentUserId,
}: NoteAccessManagerProps): JSX.Element {
  const [grants, setGrants] = useState<AccessRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [candidates, setCandidates] = useState<ShareCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Sharing writes one grant per node in the note's subtree, so reads (which select by the space's principal)
  // never need to walk the tree.
  const ids = subtreeIds(notes, note.id);

  const apply = (data: AccessData) => {
    setError(data.error);
    setGrants(data.grants);
    setProfiles(data.profiles);
  };

  useEffect(() => {
    if (!open) return;

    let active = true;

    void fetchAccess("topic_access", "topic_id", note.id).then((data) => active && apply(data));
    void fetchShareCandidates(memberTeams, currentUserId).then((r) => {
      if (!active) return;

      setCandidates(r.candidates);
      // Surface a memberships/profiles load failure without clobbering a concurrent access-fetch error.
      if (r.error) setError(r.error);
    });

    return () => {
      active = false;
    };
  }, [open, note.id, memberTeams, currentUserId]);

  const run = async (op: PromiseLike<{ error: { message: string } | null }>) => {
    const { error: writeError } = await op;

    if (writeError) setError(writeError.message);
    else apply(await fetchAccess("topic_access", "topic_id", note.id));
  };

  // A capability change or a removal targets one principal across the whole subtree.
  const byPrincipal = (op: "update" | "delete", grant: AccessRow, capability?: Capability) => {
    const base =
      op === "update"
        ? supabase.from("topic_access").update({ capability }).in("topic_id", ids)
        : supabase.from("topic_access").delete().in("topic_id", ids);

    return grant.team_id ? base.eq("team_id", grant.team_id) : base.eq("user_id", grant.user_id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Manage access">
      <AccessList
        grants={grants}
        profiles={profiles}
        error={error}
        coachedTeams={coachedTeams}
        candidates={candidates}
        teamName={teamName}
        currentUserId={currentUserId}
        entityNoun="note"
        onCreateLink={(capability) => createTopicGrantLink(note.id, capability, currentUserId)}
        onGrantByEmail={(email, capability) => grantTopicByEmail(note.id, email, capability)}
        onAdd={(kind, id, capability) =>
          void run(
            supabase.from("topic_access").insert(
              ids.map((topicId) => ({
                topic_id: topicId,
                user_id: kind === "team" ? null : id,
                team_id: kind === "team" ? id : null,
                capability,
              }))
            )
          )
        }
        onChangeCapability={(grant, capability) => void run(byPrincipal("update", grant, capability))}
        onRemove={(grant) => void run(byPrincipal("delete", grant))}
      >
        <span className={MUTED}>Sharing applies to this note and all its subnotes.</span>
      </AccessList>
    </Dialog>
  );
}
