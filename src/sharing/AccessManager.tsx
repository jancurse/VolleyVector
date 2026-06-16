import { useEffect, useState } from "react";
import type { JSX } from "react";

import type { Board } from "../boards/types";
import { supabase } from "../supabase/client";
import type { AccessRow } from "../supabase/rows";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { MUTED } from "../ui/styles";
import type { TeamRef } from "../workspace/useWorkspace";
import { AccessList } from "./AccessList";
import { fetchAccess } from "./access";
import type { AccessData, Profile } from "./access";
import { fetchShareUrl } from "./share";

// The owner's access manager for one board: the grants on its access list (a user co-editing, or a team
// whose library it lives in), each at viewer, editor, or owner. Add a teammate or a team you coach, change a
// grant's capability, remove a grant, or copy the read-only link. RLS enforces the same rules server-side.
type AccessManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: Board;
  /** Teams the caller may grant to (the teams they coach). */
  coachedTeams: readonly TeamRef[];
  /** Resolve any team's name (a grant may name a team the caller does not coach). */
  teamName: (teamId: string) => string;
  currentUserId: string;
};

export function AccessManager({
  open,
  onOpenChange,
  board,
  coachedTeams,
  teamName,
  currentUserId,
}: AccessManagerProps): JSX.Element {
  const [grants, setGrants] = useState<AccessRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [linkLabel, setLinkLabel] = useState("Copy link");

  const apply = (data: AccessData) => {
    setError(data.error);
    setGrants(data.grants);
    setProfiles(data.profiles);
  };

  useEffect(() => {
    if (!open) return;

    let active = true;

    void fetchAccess("board_access", "board_id", board.id).then((data) => active && apply(data));

    return () => {
      active = false;
    };
  }, [open, board.id]);

  const run = async (op: PromiseLike<{ error: { message: string } | null }>) => {
    const { error: writeError } = await op;

    if (writeError) setError(writeError.message);
    else apply(await fetchAccess("board_access", "board_id", board.id));
  };

  const copyLink = async () => {
    const url = await fetchShareUrl(board.id);

    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setLinkLabel("Copied");
      window.setTimeout(() => setLinkLabel("Copy link"), 1500);
    } catch {
      // The clipboard call can reject (no permission or an insecure context); leave the label as is.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Manage access">
      <AccessList
        grants={grants}
        profiles={profiles}
        error={error}
        coachedTeams={coachedTeams}
        teamName={teamName}
        currentUserId={currentUserId}
        entityNoun="board"
        onAdd={(kind, id, capability) =>
          void run(
            supabase.from("board_access").insert({
              board_id: board.id,
              user_id: kind === "team" ? null : id,
              team_id: kind === "team" ? id : null,
              capability,
            })
          )
        }
        onChangeCapability={(grant, capability) =>
          void run(supabase.from("board_access").update({ capability }).eq("id", grant.id))
        }
        onRemove={(grant) => void run(supabase.from("board_access").delete().eq("id", grant.id))}
      >
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => void copyLink()}>
            {linkLabel}
          </Button>
          <span className={MUTED}>Anyone with the link can view a shared board.</span>
        </div>
      </AccessList>
    </Dialog>
  );
}
