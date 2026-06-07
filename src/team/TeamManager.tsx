import { useState } from "react";
import type { JSX } from "react";

import { useAuth } from "../auth/useAuth";
import { inviteMember } from "../supabase/invite";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { MUTED, PANEL_TITLE } from "../ui/styles";
import type { TeamRole } from "../workspace/useWorkspace";
import { useMembers } from "./useMembers";

// The team management dialog: who is in the active team, an invite-by-email form, and (for an admin) a
// new-team form. Reached from the header by a coach or admin. Inviting goes through the server-side
// `invite` function; creating a team is a plain insert an admin's RLS allows.
type TeamManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string | null;
  teamName: string;
  isAdmin: boolean;
  onCreateTeam: (name: string) => Promise<string | null>;
};

const ROLE_OPTIONS = [
  { value: "coach", label: "Coach" },
  { value: "player", label: "Player" },
];

export function TeamManager({
  open,
  onOpenChange,
  teamId,
  teamName,
  isAdmin,
  onCreateTeam,
}: TeamManagerProps): JSX.Element {
  const { user } = useAuth();
  const { members, loading, reload, setRole: setMemberRole } = useMembers(open ? teamId : null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("player");
  const [inviting, setInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const [newTeam, setNewTeam] = useState("");
  const [createStatus, setCreateStatus] = useState<string | null>(null);

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

  const create = async () => {
    if (newTeam.trim() === "") return;

    const created = newTeam.trim();

    if (await onCreateTeam(created)) {
      setCreateStatus(`Created ${created}`);
      setNewTeam("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`Manage ${teamName}`}>
      <section className="flex flex-col gap-2">
        <span className={PANEL_TITLE}>Members</span>
        {loading ? (
          <p className={MUTED}>Loading…</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {members.map((member) => (
              <li key={member.userId} className="flex items-center justify-between gap-3 text-base">
                <span className="truncate">{member.email || member.userId}</span>
                {member.userId === user?.id ? (
                  <span className="font-mono text-2xs uppercase tracking-[0.16em] text-text-dim">{member.role}</span>
                ) : (
                  <div className="w-28 shrink-0">
                    <Select
                      ariaLabel={`Role for ${member.email || member.userId}`}
                      value={member.role}
                      options={ROLE_OPTIONS}
                      onValueChange={(next) => {
                        setRoleError(null);
                        void setMemberRole(member.userId, next === "coach" ? "coach" : "player").then(({ error }) => {
                          if (error) setRoleError(error);
                        });
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {roleError && <p className="m-0 text-sm text-danger">{roleError}</p>}
      </section>

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

      {isAdmin && (
        <section className="flex flex-col gap-2">
          <span className={PANEL_TITLE}>New team</span>
          <Field label="Team name">
            <Input value={newTeam} onChange={(event) => setNewTeam(event.target.value)} />
          </Field>
          <Button variant="ghost" onClick={() => void create()} disabled={newTeam.trim() === ""}>
            Create team
          </Button>
          {createStatus && <p className="m-0 text-sm text-text-dim">{createStatus}</p>}
        </section>
      )}
    </Dialog>
  );
}
