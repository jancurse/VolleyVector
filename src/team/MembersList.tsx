import type { JSX } from "react";
import { X } from "lucide-react";

import { IconButton } from "../ui/IconButton";
import { Select } from "../ui/Select";
import { Table, TableCell, TableHeadCell } from "../ui/Table";
import { cx, MUTED } from "../ui/styles";
import type { TeamRole } from "../workspace/useWorkspace";
import type { Member } from "./useMembers";

// The team roster, rendered through the shared Table. A coach or admin (canManage) re-roles and removes
// everyone but themselves; anyone else, and a member's own row, shows the role as a read-only chip.
// Driven by `useMembers` from the page above, so it holds no data of its own.
type MembersListProps = {
  members: readonly Member[];
  loading: boolean;
  canManage: boolean;
  currentUserId: string | undefined;
  onSetRole: (userId: string, role: TeamRole) => void;
  onRemove: (member: Member) => void;
};

const ROLE_OPTIONS = [
  { value: "coach", label: "Coach" },
  { value: "player", label: "Player" },
];

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

/** The name a roster row leads with: the display name, or the account id until one is set. */
export function memberLabel(member: Member): string {
  return member.name || member.userId;
}

export function MembersList({
  members,
  loading,
  canManage,
  currentUserId,
  onSetRole,
  onRemove,
}: MembersListProps): JSX.Element {
  if (loading) return <p className={MUTED}>Loading…</p>;
  if (members.length === 0) return <p className={MUTED}>No members yet.</p>;

  return (
    <Table width="compact">
      <thead>
        <tr>
          <TableHeadCell>Member</TableHeadCell>
          <TableHeadCell className="text-right">Role</TableHeadCell>
        </tr>
      </thead>
      <tbody>
        {members.map((member) => {
          const label = memberLabel(member);
          const manageable = canManage && member.userId !== currentUserId;

          return (
            <tr key={member.userId}>
              <TableCell className="max-w-xs truncate font-medium">{label}</TableCell>
              <TableCell className="text-right">
                <span className="flex items-center justify-end gap-1">
                  {manageable ? (
                    <Select
                      ariaLabel={`Role for ${label}`}
                      value={member.role}
                      options={ROLE_OPTIONS}
                      variant="quiet"
                      onValueChange={(next) => onSetRole(member.userId, next === "coach" ? "coach" : "player")}
                    />
                  ) : (
                    <RoleChip role={member.role} />
                  )}
                  {manageable && (
                    <IconButton
                      variant="plain"
                      size="sm"
                      aria-label={`Remove ${label}`}
                      onClick={() => onRemove(member)}
                    >
                      <X size={14} aria-hidden="true" />
                    </IconButton>
                  )}
                </span>
              </TableCell>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
