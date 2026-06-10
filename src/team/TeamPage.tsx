import { useState } from "react";
import type { JSX } from "react";

import { Button } from "../ui/Button";
import { EYEBROW, PAGE, PAGE_BAR, TITLE } from "../ui/styles";
import { useConfirm } from "../ui/useConfirm";
import type { TeamRole } from "../workspace/useWorkspace";
import { InviteDialog } from "./InviteDialog";
import { MembersTable } from "./MembersTable";
import type { Member } from "./useMembers";
import { useMembers } from "./useMembers";

// The team page: the roster of one team, plus the invite action. A coach or admin (canManage) re-roles,
// removes members, and mints invite links; any other member sees the roster read-only. Re-role and remove
// are plain writes RLS allows a team's coaches and admins. Admin-only concerns (creating, archiving, and
// deleting teams) live in the Admin area, not here.
type TeamPageProps = {
  teamId: string;
  teamName: string;
  canManage: boolean;
  currentUserId: string | undefined;
};

export function TeamPage({ teamId, teamName, canManage, currentUserId }: TeamPageProps): JSX.Element {
  const { members, loading, setRole, remove } = useMembers(teamId);
  const { confirm, dialog } = useConfirm();
  const [memberError, setMemberError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const changeRole = (userId: string, role: TeamRole) => {
    setMemberError(null);
    void setRole(userId, role).then(({ error }) => {
      if (error) setMemberError(error);
    });
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
    <section className={PAGE}>
      <div className={PAGE_BAR}>
        <div>
          <p className={EYEBROW}>Team</p>
          <h1 className={TITLE}>{teamName}</h1>
        </div>
        {canManage && (
          <Button variant="ghost" onClick={() => setInviteOpen(true)}>
            Invite member
          </Button>
        )}
      </div>

      <MembersTable
        members={members}
        loading={loading}
        canManage={canManage}
        currentUserId={currentUserId}
        onSetRole={changeRole}
        onRemove={(member) => void removeMember(member)}
      />
      {memberError && <p className="m-0 text-sm text-danger">{memberError}</p>}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} teamId={teamId} teamName={teamName} />
      {dialog}
    </section>
  );
}
