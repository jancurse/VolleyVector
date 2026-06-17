import { useState } from "react";
import type { JSX, ReactNode } from "react";
import { Trash2, User, Users } from "lucide-react";

import type { AccessRow, Capability } from "../supabase/rows";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Select } from "../ui/Select";
import { MUTED, PANEL_TITLE } from "../ui/styles";
import type { TeamRef } from "../workspace/useWorkspace";
import { CAPABILITY_OPTIONS, principalName } from "./access";
import type { Profile } from "./access";
import type { ShareCandidate } from "./candidates";
import { OutsideTeamShare } from "./OutsideTeamShare";
import { PrincipalPicker } from "./PrincipalPicker";
import type { PickerGroup } from "./PrincipalPicker";

// The shared inner UI of the board and note access managers: the grants list (each a principal, a capability
// Select, and a remove/leave action), the relationship-scoped add-access form (pick a team you coach or a
// teammate, then a capability), and the outside-teams sharing block (link or exact email). The per-manager
// write behaviour comes through the callbacks; the trailing block (a copy-link button, or a caption) renders
// as children before the error.
type AccessListProps = {
  grants: readonly AccessRow[];
  profiles: Map<string, Profile>;
  error: string | null;
  /** Teams the caller may grant to (the teams they coach). */
  coachedTeams: readonly TeamRef[];
  /** The caller's teammates, scoping the add-a-person picker to a relationship rather than all accounts. */
  candidates: readonly ShareCandidate[];
  /** Resolve any team's name (a grant may name a team the caller does not coach). */
  teamName: (teamId: string) => string;
  currentUserId: string;
  /** Names the caller's own-grant removal: "Leave this board" or "Leave this note". */
  entityNoun: "board" | "note";
  onAdd: (kind: "user" | "team", id: string, capability: Capability) => void;
  onChangeCapability: (grant: AccessRow, capability: Capability) => void;
  onRemove: (grant: AccessRow) => void;
  onCreateLink: (capability: Capability) => Promise<{ url: string | null; error: string | null }>;
  onGrantByEmail: (email: string, capability: Capability) => Promise<{ error: string | null }>;
  children?: ReactNode;
};

export function AccessList({
  grants,
  profiles,
  error,
  coachedTeams,
  candidates,
  teamName,
  currentUserId,
  entityNoun,
  onAdd,
  onChangeCapability,
  onRemove,
  onCreateLink,
  onGrantByEmail,
  children,
}: AccessListProps): JSX.Element {
  const [addPrincipal, setAddPrincipal] = useState("");
  const [addCapability, setAddCapability] = useState<Capability>("editor");

  const grantedUserIds = new Set(grants.map((g) => g.user_id).filter(Boolean));
  const grantedTeamIds = new Set(grants.map((g) => g.team_id).filter(Boolean));

  // The picker groups: a Teams group (teams the caller coaches), then one group per team for its members,
  // each not already on the list. A teammate who shares several of the caller's teams appears under each.
  const teamItems = coachedTeams
    .filter((t) => !grantedTeamIds.has(t.teamId))
    .map((t) => ({ value: `team:${t.teamId}`, label: t.teamName }));
  const memberItems = new Map<string, { heading: string; items: { value: string; label: string }[] }>();

  for (const candidate of candidates) {
    if (grantedUserIds.has(candidate.userId)) continue;

    const group = memberItems.get(candidate.teamId) ?? { heading: candidate.teamName, items: [] };

    group.items.push({ value: `user:${candidate.userId}`, label: candidate.displayName });
    memberItems.set(candidate.teamId, group);
  }

  const pickerGroups: PickerGroup[] = [
    ...(teamItems.length ? [{ heading: "Teams", items: teamItems }] : []),
    ...[...memberItems.values()].filter((g) => g.items.length > 0),
  ];

  const add = () => {
    if (!addPrincipal) return;

    const [kind, id] = addPrincipal.split(":");

    setAddPrincipal("");
    onAdd(kind as "user" | "team", id, addCapability);
  };

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <span className={PANEL_TITLE}>Who has access</span>
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {grants.map((grant) => {
            const own = grant.user_id === currentUserId;
            const name = principalName(grant, profiles, teamName);

            return (
              <li key={grant.id} className="flex items-center gap-2.5 py-1">
                <span className="grid size-8 flex-none place-items-center rounded-full border border-border bg-control text-text-dim">
                  {grant.team_id ? <Users size={15} aria-hidden="true" /> : <User size={15} aria-hidden="true" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {grant.team_id ? teamName(grant.team_id) : name}
                  {own && <span className={MUTED}> (you)</span>}
                </span>
                <Select
                  ariaLabel={`Capability for ${name}`}
                  variant="quiet"
                  value={grant.capability}
                  options={CAPABILITY_OPTIONS}
                  onValueChange={(value) => onChangeCapability(grant, value as Capability)}
                />
                <IconButton
                  variant="plain"
                  aria-label={own ? `Leave this ${entityNoun}` : "Remove access"}
                  onClick={() => onRemove(grant)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </IconButton>
              </li>
            );
          })}
        </ul>

        {pickerGroups.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <PrincipalPicker
                groups={pickerGroups}
                value={addPrincipal}
                onValueChange={setAddPrincipal}
                ariaLabel="Add a person or team"
              />
            </div>
            <div className="w-28 shrink-0">
              <Select
                ariaLabel="Capability"
                value={addCapability}
                options={CAPABILITY_OPTIONS}
                onValueChange={(value) => setAddCapability(value as Capability)}
              />
            </div>
            <Button onClick={add} disabled={!addPrincipal}>
              Add
            </Button>
          </div>
        )}
      </div>

      <OutsideTeamShare entityNoun={entityNoun} onCreateLink={onCreateLink} onGrantByEmail={onGrantByEmail} />

      {children}

      {error && <p className="m-0 text-sm text-danger">{error}</p>}
    </section>
  );
}
