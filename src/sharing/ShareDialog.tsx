import { useState } from "react";
import type { JSX } from "react";

import type { Board } from "../boards/types";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { Select } from "../ui/Select";
import { MUTED, PANEL_TITLE } from "../ui/styles";
import type { TeamMembership } from "../workspace/useWorkspace";
import { fetchShareUrl } from "./share";

// The owner's controls for one personal board: make it visible to a team (and copy its read-only link),
// stop sharing it, and promote it into a team library the owner coaches by copying or moving it. Team
// writes are the owner's alone here; RLS enforces the same. Reached from the board view's Share action.
type ShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: Board;
  /** The owner's memberships: any team is a share target; a coached team is also a promotion target. */
  teams: readonly TeamMembership[];
  onShare: (teamId: string) => void;
  onUnshare: () => void;
  onMoveToTeam: (teamId: string) => void;
  onCopyToTeam: (teamId: string) => Promise<{ error: string | null }>;
};

export function ShareDialog({
  open,
  onOpenChange,
  board,
  teams,
  onShare,
  onUnshare,
  onMoveToTeam,
  onCopyToTeam,
}: ShareDialogProps): JSX.Element {
  const coached = teams.filter((t) => t.role === "coach");

  const [target, setTarget] = useState(teams[0]?.teamId ?? "");
  const [promoteTarget, setPromoteTarget] = useState(coached[0]?.teamId ?? "");
  const [linkLabel, setLinkLabel] = useState("Copy link");
  const [promoteStatus, setPromoteStatus] = useState<string | null>(null);

  const sharedTeamName = teams.find((t) => t.teamId === board.teamId)?.teamName ?? "a team";

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

  const copyToTeam = async () => {
    if (!promoteTarget) return;

    setPromoteStatus(null);

    const { error } = await onCopyToTeam(promoteTarget);

    setPromoteStatus(error ?? "Copied to the team library");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Share board">
      <section className="flex flex-col gap-2">
        <span className={PANEL_TITLE}>Team visibility</span>
        {board.shared ? (
          <>
            <p className={MUTED}>Shared with {sharedTeamName}. Anyone with the link can view it.</p>
            <div className="flex gap-2">
              <Button onClick={() => void copyLink()}>{linkLabel}</Button>
              <Button variant="ghost" onClick={onUnshare}>
                Stop sharing
              </Button>
            </div>
          </>
        ) : teams.length === 0 ? (
          <p className={MUTED}>Join a team to share this board.</p>
        ) : (
          <>
            <p className={MUTED}>Make this board visible to a team and get a read-only link.</p>
            <Field label="Team">
              <Select
                ariaLabel="Share with team"
                value={target}
                options={teams.map((t) => ({ value: t.teamId, label: t.teamName }))}
                onValueChange={setTarget}
              />
            </Field>
            <Button onClick={() => target && onShare(target)} disabled={!target}>
              Share
            </Button>
          </>
        )}
      </section>

      {coached.length > 0 && (
        <section className="flex flex-col gap-2">
          <span className={PANEL_TITLE}>Add to a team library</span>
          <p className={MUTED}>Copy keeps this board in My Boards; move relocates it into the team.</p>
          <Field label="Team">
            <Select
              ariaLabel="Promote to team"
              value={promoteTarget}
              options={coached.map((t) => ({ value: t.teamId, label: t.teamName }))}
              onValueChange={setPromoteTarget}
            />
          </Field>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => void copyToTeam()} disabled={!promoteTarget}>
              Copy to library
            </Button>
            <Button
              variant="ghost"
              onClick={() => promoteTarget && onMoveToTeam(promoteTarget)}
              disabled={!promoteTarget}
            >
              Move to library
            </Button>
          </div>
          {promoteStatus && <p className="m-0 text-sm text-text-dim">{promoteStatus}</p>}
        </section>
      )}
    </Dialog>
  );
}
