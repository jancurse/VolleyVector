import { useState } from "react";
import type { JSX } from "react";

import { useAuth } from "../auth/useAuth";
import { inviteMember } from "../supabase/invite";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { cx, MUTED, PANEL_TITLE } from "../ui/styles";
import { useConfirm } from "../ui/useConfirm";
import type { TeamRole } from "../workspace/useWorkspace";
import type { Member } from "./useMembers";
import { useMembers } from "./useMembers";

// The team menu: the roster of the active team, open to any member. A player sees it read-only; a
// coach or admin (canManage) also re-roles, removes, and invites members. Inviting goes through the
// server-side `invite` function; re-role and remove are plain writes RLS allows a team's coaches and
// admins. Admin-only concerns (creating teams) live in the separate AdminManager.
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
  const { members, loading, reload, setRole: setMemberRole, remove } = useMembers(open ? teamId : null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("player");
  const [inviting, setInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);

  const invite = async () => {
    if (!teamId || email.trim() === "") return;

    setInviting(true);
    setInviteStatus(null);

    const { error } = await inviteMember(email.trim(), teamId, role);

    setInviting(false);

    if (error) {
      setInviteStatus(error);

      return;
    }

    setInviteStatus(`Invited ${email.trim()}`);
    setEmail("");
    reload();
  };

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
        <section className="flex flex-col gap-2">
          <span className={PANEL_TITLE}>Invite a member</span>
          <Field label="Email">
            <Input type="email" value={email} autoComplete="off" onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Role">
            <Select
              ariaLabel="Invite role"
              value={role}
              options={ROLE_OPTIONS}
              onValueChange={(next) => setRole(next === "coach" ? "coach" : "player")}
            />
          </Field>
          <Button onClick={() => void invite()} disabled={inviting || email.trim() === ""}>
            {inviting ? "Inviting…" : "Send invite"}
          </Button>
          {inviteStatus && <p className="m-0 text-sm text-text-dim">{inviteStatus}</p>}
        </section>
      )}
      {dialog}
    </Dialog>
  );
}
