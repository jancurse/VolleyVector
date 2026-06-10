import type { JSX, ReactNode } from "react";
import { ListTree, ShieldCheck } from "lucide-react";

import { Tooltip } from "../ui/Tooltip";
import { cx } from "../ui/styles";
import { sameSpace } from "../workspace/space";
import type { Space } from "../workspace/space";
import type { TeamMembership, TeamRef } from "../workspace/useWorkspace";
import { badgeText } from "./SpaceSwitcher";
import { BrandMark } from "./BrandMark";

// The slim icon rail the sidebar collapses to at middling widths: the brand glyph, one initial badge
// per space, a toggle that expands the full sidebar as an overlay, and the admin entry at the foot.
// Everything carries a tooltip since the rail shows no text. Like the full sidebar's rows, the items
// are hand-rolled nav buttons rather than IconButtons, so the active accent fill applies cleanly.
type SidebarRailProps = {
  activeSpace: Space;
  teams: readonly TeamMembership[];
  /** Admin-only non-member teams; the rail shows only the active one, the rest live in the expanded sidebar. */
  otherTeams: readonly TeamRef[];
  onSwitchSpace: (space: Space) => void;
  /** Whether the expanded-sidebar overlay is open; the Topics toggle stays highlighted while it is. */
  expanded: boolean;
  onExpand: () => void;
  isAdmin: boolean;
  adminActive: boolean;
  onOpenAdmin: () => void;
};

const ITEM =
  "grid size-8 flex-none cursor-pointer place-items-center rounded-md transition-colors duration-150 ease-settle";
const BADGE = cx(ITEM, "rounded-sm border font-mono text-2xs font-bold uppercase");
const BADGE_OFF = "border-border bg-control text-text-dim hover:bg-control-hover hover:text-text";
const BADGE_ON = "border-accent/40 bg-accent-weak text-accent";
const TOGGLE_OFF = "border-0 bg-transparent text-text-dim hover:bg-control hover:text-text";
const TOGGLE_ON = "border-0 bg-accent-weak text-text";

function RailButton({
  label,
  active,
  className,
  onClick,
  expanded,
  children,
}: {
  label: string;
  active?: boolean;
  className: string;
  onClick: () => void;
  expanded?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <Tooltip label={label} side="right">
      <button
        type="button"
        aria-label={label}
        aria-current={active}
        aria-expanded={expanded}
        className={className}
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function SidebarRail({
  activeSpace,
  teams,
  otherTeams,
  onSwitchSpace,
  expanded,
  onExpand,
  isAdmin,
  adminActive,
  onOpenAdmin,
}: SidebarRailProps): JSX.Element {
  const spaces: { key: string; name: string; space: Space }[] = [
    { key: "personal", name: "Personal", space: { kind: "personal" } },
    ...[...teams, ...otherTeams.filter((t) => activeSpace.kind === "team" && activeSpace.teamId === t.teamId)].map(
      (t) => ({ key: t.teamId, name: t.teamName, space: { kind: "team", teamId: t.teamId } as Space })
    ),
  ];

  return (
    <aside className="sticky top-0 flex h-[100dvh] flex-col items-center gap-1.5 border-r border-border bg-[color-mix(in_srgb,var(--court-surface)_45%,transparent)] py-4 text-text">
      <BrandMark />

      <div className="mt-4 flex flex-col items-center gap-1.5">
        {spaces.map(({ key, name, space }) => {
          const active = sameSpace(activeSpace, space);

          return (
            <RailButton
              key={key}
              label={name}
              active={active}
              className={cx(BADGE, active ? BADGE_ON : BADGE_OFF)}
              onClick={() => onSwitchSpace(space)}
            >
              {badgeText(name)}
            </RailButton>
          );
        })}
      </div>

      <RailButton
        label="Topics"
        expanded={expanded}
        className={cx(ITEM, "mt-2", expanded ? TOGGLE_ON : TOGGLE_OFF)}
        onClick={onExpand}
      >
        <ListTree size={16} aria-hidden="true" />
      </RailButton>

      <div className="flex-1" />

      {isAdmin && (
        <RailButton
          label="Admin"
          active={adminActive}
          className={cx(ITEM, adminActive ? TOGGLE_ON : TOGGLE_OFF)}
          onClick={onOpenAdmin}
        >
          <ShieldCheck size={16} aria-hidden="true" />
        </RailButton>
      )}
    </aside>
  );
}
