import type { JSX } from "react";
import { X } from "lucide-react";

import { IconButton } from "../ui/IconButton";
import { Select } from "../ui/Select";
import { initials } from "../ui/initials";
import { cx, MUTED, TABLE_FRAME } from "../ui/styles";
import type { TeamRole } from "../workspace/useWorkspace";
import type { Member } from "./useMembers";

// The team roster as a bounded list: an initials disc, the display name over a quiet email line, and the
// role on the right. A coach or admin (canManage) re-roles and removes everyone but themselves; anyone
// else, and a member's own row, shows the role as a read-only chip. Driven by `useMembers` from the page
// above, so it holds no data of its own.
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

const DISC =
  "grid size-9 flex-none place-items-center rounded-full border border-border bg-accent-weak font-mono text-sm font-semibold text-accent";

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

/** The name a roster row leads with: the display name, or the email until one is set. */
export function memberLabel(member: Member): string {
  return member.name || member.email || member.userId;
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
    <ul className={cx(TABLE_FRAME, "m-0 w-full max-w-2xl list-none p-0")}>
      {members.map((member) => {
        const label = memberLabel(member);
        const manageable = canManage && member.userId !== currentUserId;

        return (
          <li key={member.userId} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
            <span aria-hidden="true" className={DISC}>
              {initials(member.name || member.email)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-text">{label}</span>
              {member.name && member.email && (
                <span className="block truncate text-xs text-text-dim" title={member.email}>
                  {member.email}
                </span>
              )}
            </span>
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
            {canManage && (
              <span className="grid w-7.5 flex-none place-items-center">
                {manageable && (
                  <IconButton variant="plain" size="sm" aria-label={`Remove ${label}`} onClick={() => onRemove(member)}>
                    <X size={14} aria-hidden="true" />
                  </IconButton>
                )}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
