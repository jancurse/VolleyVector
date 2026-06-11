import { useState } from "react";
import type { JSX, ReactNode } from "react";
import { ChevronDown, ChevronRight, Lightbulb, Settings } from "lucide-react";

import { IconButton } from "../ui/IconButton";
import { cx, FIELD_LABEL } from "../ui/styles";
import type { Space } from "../workspace/space";
import type { TeamMembership, TeamRef } from "../workspace/useWorkspace";

// The space picker at the top of the sidebar: the personal space plus each team the user belongs to, as a
// short list of rows rather than a dropdown. The read-only showcase space (Inspiration) follows the teams
// with an icon badge, and an admin's remaining teams sit behind a collapsed "Other teams" disclosure so
// the list stays short as teams grow. The active row is highlighted; the active team row carries a gear
// that opens its management page, shown only when the user may curate that team.
type SpaceSwitcherProps = {
  activeSpace: Space;
  teams: readonly TeamMembership[];
  /** Teams reachable without a membership (admins only); hidden behind the "Other teams" disclosure. */
  otherTeams: readonly TeamRef[];
  /** The showcase space everyone may browse, or null if none exists. */
  showcase: TeamRef | null;
  onSwitch: (space: Space) => void;
  /** Whether the active team may be managed by this user (a coach of it, or an admin). */
  canManageActiveTeam: boolean;
  onManageTeam: (teamId: string) => void;
};

const ROW =
  "group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left font-ui text-base font-semibold transition-colors duration-150 ease-settle";
const ROW_ON = "bg-accent-weak text-text";
const ROW_OFF = "text-text-dim hover:bg-control hover:text-text";
const BADGE =
  "grid size-6 flex-none place-items-center rounded-sm border border-border font-mono text-2xs font-bold uppercase";

/** The initial a space's badge shows, shared with the icon rail. */
export function badgeText(label: string): string {
  return label.trim()[0]?.toUpperCase() ?? "?";
}

function TeamRow({
  team,
  active,
  canManage,
  onSwitch,
  onManage,
  icon,
}: {
  team: TeamRef;
  active: boolean;
  canManage: boolean;
  onSwitch: (space: Space) => void;
  onManage: (teamId: string) => void;
  /** Replaces the initial in the badge (the showcase row's glyph). */
  icon?: ReactNode;
}): JSX.Element {
  return (
    <div className="relative flex items-center">
      <button
        type="button"
        aria-current={active}
        className={cx(ROW, active ? ROW_ON : ROW_OFF, active && canManage && "pr-9")}
        onClick={() => onSwitch({ kind: "team", teamId: team.teamId })}
      >
        <span
          aria-hidden="true"
          className={cx(BADGE, active ? "border-accent/40 bg-accent-weak text-accent" : "bg-control")}
        >
          {icon ?? badgeText(team.teamName)}
        </span>
        <span className="truncate">{team.teamName}</span>
      </button>
      {active && canManage && (
        <IconButton
          variant="plain"
          size="sm"
          aria-label={`Manage ${team.teamName}`}
          tooltipSide="right"
          className="absolute right-1"
          onClick={() => onManage(team.teamId)}
        >
          <Settings size={16} aria-hidden="true" />
        </IconButton>
      )}
    </div>
  );
}

export function SpaceSwitcher({
  activeSpace,
  teams,
  otherTeams,
  showcase,
  onSwitch,
  canManageActiveTeam,
  onManageTeam,
}: SpaceSwitcherProps): JSX.Element {
  const personalActive = activeSpace.kind === "personal";
  const [othersOpen, setOthersOpen] = useState(false);
  // The disclosure cannot collapse while one of the other teams is the active space.
  const otherActive = otherTeams.some((t) => activeSpace.kind === "team" && activeSpace.teamId === t.teamId);
  const showOthers = othersOpen || otherActive;

  return (
    <div className="flex flex-col gap-1">
      <p className={cx(FIELD_LABEL, "px-2")}>Spaces</p>
      <div className="flex flex-col gap-px">
        <button
          type="button"
          aria-current={personalActive}
          className={cx(ROW, personalActive ? ROW_ON : ROW_OFF)}
          onClick={() => onSwitch({ kind: "personal" })}
        >
          <span
            aria-hidden="true"
            className={cx(BADGE, personalActive ? "border-accent/40 bg-accent-weak text-accent" : "bg-control")}
          >
            P
          </span>
          <span className="truncate">Personal</span>
        </button>

        {teams.map((team) => (
          <TeamRow
            key={team.teamId}
            team={team}
            active={activeSpace.kind === "team" && activeSpace.teamId === team.teamId}
            canManage={canManageActiveTeam}
            onSwitch={onSwitch}
            onManage={onManageTeam}
          />
        ))}

        {showcase && (
          <TeamRow
            team={showcase}
            active={activeSpace.kind === "team" && activeSpace.teamId === showcase.teamId}
            canManage={canManageActiveTeam}
            onSwitch={onSwitch}
            onManage={onManageTeam}
            icon={<Lightbulb size={13} />}
          />
        )}

        {otherTeams.length > 0 && (
          <>
            <button
              type="button"
              aria-expanded={showOthers}
              className={cx(ROW, ROW_OFF, "text-sm font-medium")}
              onClick={() => setOthersOpen((open) => !open)}
            >
              {showOthers ? (
                <ChevronDown size={14} aria-hidden="true" className="flex-none" />
              ) : (
                <ChevronRight size={14} aria-hidden="true" className="flex-none" />
              )}
              Other teams
            </button>
            {showOthers &&
              otherTeams.map((team) => (
                <TeamRow
                  key={team.teamId}
                  team={team}
                  active={activeSpace.kind === "team" && activeSpace.teamId === team.teamId}
                  canManage={canManageActiveTeam}
                  onSwitch={onSwitch}
                  onManage={onManageTeam}
                />
              ))}
          </>
        )}
      </div>
    </div>
  );
}
