import type { JSX } from "react";
import { ShieldCheck } from "lucide-react";

import type { Selection } from "../library/selection";
import { NoteSidebar } from "../notes/NoteSidebar";
import type { Note } from "../notes/types";
import { cx } from "../ui/styles";
import type { Space } from "../workspace/space";
import type { TeamMembership, TeamRef } from "../workspace/useWorkspace";
import { BrandLockup } from "./BrandMark";
import { SpaceSwitcher } from "./SpaceSwitcher";

// The persistent left column, present on every authenticated surface including board view and edit. Top
// to bottom: the brand, the space switcher, the scrolling note navigation, and an admin entry pinned at
// the foot for admins. The board view and editor keep the full content width; only this column is fixed.
type SidebarProps = {
  activeSpace: Space;
  teams: readonly TeamMembership[];
  otherTeams: readonly TeamRef[];
  showcase: TeamRef | null;
  onSwitchSpace: (space: Space) => void;
  canManageActiveTeam: boolean;
  onManageTeam: (teamId: string) => void;
  onCreateTeam: (name: string) => Promise<string | null>;
  notes: readonly Note[];
  selection: Selection;
  onSelectNote: (selection: Selection) => void;
  onNewNote: () => void;
  onReorderNote: (id: string, dir: -1 | 1) => void;
  onNestNote: (id: string, parentId: string | null) => void;
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
  onCreateTeam,
  notes,
  selection,
  onSelectNote,
  onNewNote,
  onReorderNote,
  onNestNote,
  canEdit,
  isAdmin,
  adminActive,
  onOpenAdmin,
}: SidebarProps): JSX.Element {
  return (
    <aside className="sticky top-0 flex h-[100dvh] flex-col border-r border-border bg-[color-mix(in_srgb,var(--court-surface)_45%,transparent)]">
      <div className="flex flex-col gap-5 px-3 pt-4 pb-3">
        <div className="px-2">
          <BrandLockup />
        </div>

        <SpaceSwitcher
          activeSpace={activeSpace}
          teams={teams}
          otherTeams={otherTeams}
          showcase={showcase}
          onSwitch={onSwitchSpace}
          canManageActiveTeam={canManageActiveTeam}
          onManageTeam={onManageTeam}
          onCreateTeam={onCreateTeam}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <NoteSidebar
          notes={notes}
          selection={selection}
          onSelect={onSelectNote}
          onNewNote={onNewNote}
          onReorder={onReorderNote}
          onNest={onNestNote}
          canEdit={canEdit}
        />
      </div>

      {isAdmin && (
        <div className="flex flex-col gap-px border-t border-border px-3 py-2">
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
