import type { JSX } from "react";

import { supabase } from "../supabase/client";
import type { AccessRow, Capability } from "../supabase/rows";
import { subtreeIds } from "../notes/operations";
import type { Note } from "../notes/types";
import { Dialog } from "../ui/Dialog";
import { MUTED } from "../ui/styles";
import type { TeamRef } from "../workspace/useWorkspace";
import { AccessList } from "./AccessList";
import { createTopicGrantLink, grantTopicByEmail } from "./grants";
import { useAccessManager } from "./useAccessManager";

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
  // Sharing writes one grant per node in the note's subtree, so reads (which select by the space's principal)
  // never need to walk the tree.
  const ids = subtreeIds(notes, note.id);

  // A capability change or a removal targets one principal across the whole subtree.
  const byPrincipal = (op: "update" | "delete", grant: AccessRow, capability?: Capability) => {
    const base =
      op === "update"
        ? supabase.from("topic_access").update({ capability }).in("topic_id", ids)
        : supabase.from("topic_access").delete().in("topic_id", ids);

    return grant.team_id ? base.eq("team_id", grant.team_id) : base.eq("user_id", grant.user_id);
  };

  const access = useAccessManager(
    open,
    {
      table: "topic_access",
      idColumn: "topic_id",
      id: note.id,
      add: (kind, id, capability) =>
        supabase.from("topic_access").insert(
          ids.map((topicId) => ({
            topic_id: topicId,
            user_id: kind === "team" ? null : id,
            team_id: kind === "team" ? id : null,
            capability,
          }))
        ),
      changeCapability: (grant, capability) => byPrincipal("update", grant, capability),
      remove: (grant) => byPrincipal("delete", grant),
      createLink: (capability) => createTopicGrantLink(note.id, capability, currentUserId),
      grantByEmail: (email, capability) => grantTopicByEmail(note.id, email, capability),
    },
    memberTeams,
    currentUserId
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Manage access">
      {access.loading ? (
        <p className={MUTED}>Loading…</p>
      ) : (
        <AccessList
          grants={access.grants}
          profiles={access.profiles}
          error={access.error}
          coachedTeams={coachedTeams}
          candidates={access.candidates}
          teamName={teamName}
          currentUserId={currentUserId}
          entityNoun="note"
          onCreateLink={access.onCreateLink}
          onGrantByEmail={access.onGrantByEmail}
          onAdd={access.onAdd}
          onChangeCapability={access.onChangeCapability}
          onRemove={access.onRemove}
        >
          <span className={MUTED}>Sharing applies to this note and all its subnotes.</span>
        </AccessList>
      )}
    </Dialog>
  );
}
