import type { JSX } from "react";
import { X } from "lucide-react";

import { IconButton } from "../ui/IconButton";
import { Select } from "../ui/Select";
import { cx, MUTED, TABLE, TABLE_CELL, TABLE_FRAME, TABLE_HEAD_CELL } from "../ui/styles";
import type { TeamRole } from "../workspace/useWorkspace";
import type { Member } from "./useMembers";

// The team roster as a table. A coach or admin (canManage) re-roles and removes everyone but themselves;
// anyone else, and a member's own row, shows the role as a read-only chip. Driven by `useMembers` from
// the page above, so it holds no data of its own.
type MembersTableProps = {
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

export function MembersTable({
  members,
  loading,
  canManage,
  currentUserId,
  onSetRole,
  onRemove,
}: MembersTableProps): JSX.Element {
  if (loading) return <p className={MUTED}>Loading…</p>;
  if (members.length === 0) return <p className={MUTED}>No members yet.</p>;

  return (
    <div className={TABLE_FRAME}>
      <table className={TABLE}>
        <thead>
          <tr>
            <th className={TABLE_HEAD_CELL}>Member</th>
            <th className={cx(TABLE_HEAD_CELL, "w-40")}>Role</th>
            {canManage && (
              <th className={cx(TABLE_HEAD_CELL, "w-12")}>
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const label = member.email || member.userId;
            const manageable = canManage && member.userId !== currentUserId;

            return (
              <tr key={member.userId}>
                <td className={cx(TABLE_CELL, "max-w-0 truncate")}>{label}</td>
                <td className={TABLE_CELL}>
                  {manageable ? (
                    <Select
                      ariaLabel={`Role for ${label}`}
                      value={member.role}
                      options={ROLE_OPTIONS}
                      onValueChange={(next) => onSetRole(member.userId, next === "coach" ? "coach" : "player")}
                    />
                  ) : (
                    <RoleChip role={member.role} />
                  )}
                </td>
                {canManage && (
                  <td className={cx(TABLE_CELL, "text-right")}>
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
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
