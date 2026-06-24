import type { JSX } from "react";

import type { Board } from "../boards/types";
import { supabase } from "../supabase/client";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { MUTED, PANEL_TITLE } from "../ui/styles";
import { useCopyLabel } from "../ui/useCopyLabel";
import type { TeamRef } from "../workspace/useWorkspace";
import { AccessList } from "./AccessList";
import { createBoardGrantLink, grantBoardByEmail } from "./grants";
import { fetchShareUrl } from "./share";
import { useAccessManager } from "./useAccessManager";

// The owner's access manager for one board: the grants on its access list (a user co-editing, or a team
// whose library it lives in), each at viewer, editor, or owner. Add a teammate or a team you coach, change a
// grant's capability, remove a grant, or copy the read-only link. RLS enforces the same rules server-side.
type AccessManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: Board;
  /** Teams the caller may grant to (the teams they coach). */
  coachedTeams: readonly TeamRef[];
  /** Teams the caller belongs to, scoping the add-a-person picker to their teammates. */
  memberTeams: readonly TeamRef[];
  /** Resolve any team's name (a grant may name a team the caller does not coach). */
  teamName: (teamId: string) => string;
  currentUserId: string;
};

export function AccessManager({
  open,
  onOpenChange,
  board,
  coachedTeams,
  memberTeams,
  teamName,
  currentUserId,
}: AccessManagerProps): JSX.Element {
  const { copied, copy } = useCopyLabel();

  const access = useAccessManager(
    open,
    {
      table: "board_access",
      idColumn: "board_id",
      id: board.id,
      add: (kind, id, capability) =>
        supabase.from("board_access").insert({
          board_id: board.id,
          user_id: kind === "team" ? null : id,
          team_id: kind === "team" ? id : null,
          capability,
        }),
      changeCapability: (grant, capability) => supabase.from("board_access").update({ capability }).eq("id", grant.id),
      remove: (grant) => supabase.from("board_access").delete().eq("id", grant.id),
      createLink: (capability) => createBoardGrantLink(board.id, capability, currentUserId),
      grantByEmail: (email, capability) => grantBoardByEmail(board.id, email, capability),
    },
    memberTeams,
    currentUserId
  );

  const copyLink = async () => {
    const url = await fetchShareUrl(board.id);

    if (url) copy(url);
  };

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
          entityNoun="board"
          onCreateLink={access.onCreateLink}
          onGrantByEmail={access.onGrantByEmail}
          onAdd={access.onAdd}
          onChangeCapability={access.onChangeCapability}
          onRemove={access.onRemove}
        >
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <span className={PANEL_TITLE}>View-only link</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => void copyLink()}>
                {copied ? "Copied" : "Copy view-only link"}
              </Button>
              <span className={MUTED}>Permanent link: anyone can view</span>
            </div>
          </div>
        </AccessList>
      )}
    </Dialog>
  );
}
