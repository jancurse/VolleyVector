import { useState } from "react";
import type { JSX } from "react";

import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Select } from "../ui/Select";
import { cx, MUTED, PANEL_TITLE } from "../ui/styles";
import { useConfirm } from "../ui/useConfirm";
import type { TeamRole } from "../workspace/useWorkspace";
import { InviteDialog } from "./InviteDialog";
import type { Member } from "./useMembers";
import { useMembers } from "./useMembers";

// The team menu: the roster of the active team, open to any member. A player sees it read-only; a
// coach or admin (canManage) also re-roles and removes members, and opens the invite dialog. Re-role and
// remove are plain writes RLS allows a team's coaches and admins; inviting (by email or link) lives in
// InviteDialog. Admin-only concerns (creating teams) live in the separate AdminManager.
type TeamManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string | null;
  teamName: string;
  canManage: boolean;
};

const ROLE_OPTIONS = [
  { value: "coach", label: "Coach" },
  { value: "player", label: "Player" },
];

const REMOVE_BUTTON =
  "grid size-7 flex-none place-items-center rounded-md text-text-dim opacity-0 outline-none transition-[opacity,color,background-color] duration-150 ease-settle hover:bg-control-hover hover:text-danger focus-visible:opacity-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent group-hover:opacity-100 group-focus-within:opacity-100";

function RoleChip({ role }: { role: TeamRole }): JSX.Element {
  return (
    <span
      className={cx(
        "rounded-pill px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.16em]",
        role === "coach" ? "bg-accent-weak text-accent" : "text-text-dim"
      )}
    >
      {role}
    </span>
  );
}

export function TeamManager({ open, onOpenChange, teamId, teamName, canManage }: TeamManagerProps): JSX.Element {
  const { user } = useAuth();
  const { confirm, dialog } = useConfirm();
  const { members, loading, setRole: setMemberRole, remove } = useMembers(open ? teamId : null);

  const [memberError, setMemberError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const removeMember = async (member: Member) => {
    setMemberError(null);

    const ok = await confirm({
      title: `Remove ${member.email || "this member"}?`,
      description: `They will lose access to ${teamName}.`,
      confirmLabel: "Remove",
      danger: true,
    });

    if (!ok) return;

    const { error } = await remove(member.userId);

    if (error) setMemberError(error);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={teamName}>
      <section className="flex flex-col gap-2">
        <span className={PANEL_TITLE}>Members</span>
        {loading ? (
          <p className={MUTED}>Loading…</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {members.map((member) => {
              const isSelf = member.userId === user?.id;

              return (
                <li
                  key={member.userId}
                  className="group -mx-1.5 flex items-center justify-between gap-3 rounded-md px-1.5 py-1 text-base"
                >
                  <span className="truncate">{member.email || member.userId}</span>
                  {canManage && !isSelf ? (
                    <div className="flex items-center gap-1">
                      <div className="w-28 shrink-0">
                        <Select
                          ariaLabel={`Role for ${member.email || member.userId}`}
                          value={member.role}
                          options={ROLE_OPTIONS}
                          onValueChange={(next) => {
                            setMemberError(null);
                            void setMemberRole(member.userId, next === "coach" ? "coach" : "player").then(
                              ({ error }) => {
                                if (error) setMemberError(error);
                              }
                            );
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className={REMOVE_BUTTON}
                        aria-label={`Remove ${member.email || member.userId}`}
                        onClick={() => void removeMember(member)}
                      >
                        <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden="true">
                          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <RoleChip role={member.role} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {memberError && <p className="m-0 text-sm text-danger">{memberError}</p>}
      </section>

      {canManage && (
        <Button variant="ghost" onClick={() => setInviteOpen(true)}>
          Invite member
        </Button>
      )}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} teamId={teamId} teamName={teamName} />
      {dialog}
    </Dialog>
  );
}
