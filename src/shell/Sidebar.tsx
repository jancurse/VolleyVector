import type { JSX } from "react";
import { ShieldCheck } from "lucide-react";

import type { Selection } from "../library/selection";
import { TopicSidebar } from "../topics/TopicSidebar";
import type { Topic } from "../topics/types";
import { cx } from "../ui/styles";
import type { Space } from "../workspace/space";
import type { TeamMembership, TeamRef } from "../workspace/useWorkspace";
import { BrandMark } from "./BrandMark";
import { SpaceSwitcher } from "./SpaceSwitcher";

// The persistent left column, present on every authenticated surface including board view and edit. Top
// to bottom: the brand, the space switcher, the scrolling topic navigation, and an admin entry pinned at
// the foot for admins. The board view and editor keep the full content width; only this column is fixed.
type SidebarProps = {
  activeSpace: Space;
  teams: readonly TeamMembership[];
  otherTeams: readonly TeamRef[];
  showcase: TeamRef | null;
  onSwitchSpace: (space: Space) => void;
  canManageActiveTeam: boolean;
  onManageTeam: (teamId: string) => void;
  topics: readonly Topic[];
  selection: Selection;
  onSelectTopic: (selection: Selection) => void;
  onNewTopic: () => void;
  onReorderTopic: (id: string, dir: -1 | 1) => void;
  onNestTopic: (id: string, parentId: string | null) => void;
  canEdit: boolean;
  isAdmin: boolean;
  adminActive: boolean;
  onOpenAdmin: () => void;
};

const ADMIN_ENTRY =
  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left font-ui text-base font-semibold transition-colors duration-150 ease-settle";

export function Sidebar({
  activeSpace,
  teams,
  otherTeams,
  showcase,
  onSwitchSpace,
  canManageActiveTeam,
  onManageTeam,
  topics,
  selection,
  onSelectTopic,
  onNewTopic,
  onReorderTopic,
  onNestTopic,
  canEdit,
  isAdmin,
  adminActive,
  onOpenAdmin,
}: SidebarProps): JSX.Element {
  return (
    <aside className="sticky top-0 flex h-[100dvh] flex-col border-r border-border bg-[color-mix(in_srgb,var(--court-surface)_45%,transparent)]">
      <div className="flex flex-col gap-5 px-3 pt-4 pb-3">
        <div className="flex items-center gap-2.5 px-2 font-display text-display-md font-bold tracking-[-0.02em] text-text">
          <BrandMark />
          <span>VolleyCoach</span>
        </div>

        <SpaceSwitcher
          activeSpace={activeSpace}
          teams={teams}
          otherTeams={otherTeams}
          showcase={showcase}
          onSwitch={onSwitchSpace}
          canManageActiveTeam={canManageActiveTeam}
          onManageTeam={onManageTeam}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <TopicSidebar
          topics={topics}
          selection={selection}
          onSelect={onSelectTopic}
          onNewTopic={onNewTopic}
          onReorder={onReorderTopic}
          onNest={onNestTopic}
          canEdit={canEdit}
        />
      </div>

      {isAdmin && (
        <div className="border-t border-border px-3 py-2">
          <button
            type="button"
            aria-current={adminActive}
            className={cx(
              ADMIN_ENTRY,
              adminActive ? "bg-accent-weak text-text" : "text-text-dim hover:bg-control hover:text-text"
            )}
            onClick={onOpenAdmin}
          >
            <ShieldCheck size={18} aria-hidden="true" className="flex-none" />
            Admin
          </button>
        </div>
      )}
    </aside>
  );
}
