import { useState } from "react";
import type { JSX, ReactNode } from "react";
import { Trash2 } from "lucide-react";

import type { AccessRow, Capability } from "../supabase/rows";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { Select } from "../ui/Select";
import { MUTED, PANEL_TITLE } from "../ui/styles";
import type { TeamRef } from "../workspace/useWorkspace";
import { CAPABILITY_OPTIONS, principalName } from "./access";
import type { Profile } from "./access";

// The shared inner UI of the board and note access managers: the grants list (each a principal, a capability
// Select, and a remove/leave action) and the add-access form (a principal and capability Select plus Add),
// shown only when there is someone to add. The add-form state and candidate lists live here; the per-manager
// write behaviour comes through the callbacks, and the trailing block (a copy-link button, or a caption)
// renders as children before the error.
type AccessListProps = {
  grants: readonly AccessRow[];
  profiles: Map<string, Profile>;
  error: string | null;
  /** Teams the caller may grant to (the teams they coach). */
  coachedTeams: readonly TeamRef[];
  /** Resolve any team's name (a grant may name a team the caller does not coach). */
  teamName: (teamId: string) => string;
  currentUserId: string;
  /** Names the caller's own-grant removal: "Leave this board" or "Leave this note". */
  entityNoun: "board" | "note";
  onAdd: (kind: "user" | "team", id: string, capability: Capability) => void;
  onChangeCapability: (grant: AccessRow, capability: Capability) => void;
  onRemove: (grant: AccessRow) => void;
  children?: ReactNode;
};

export function AccessList({
  grants,
  profiles,
  error,
  coachedTeams,
  teamName,
  currentUserId,
  entityNoun,
  onAdd,
  onChangeCapability,
  onRemove,
  children,
}: AccessListProps): JSX.Element {
  const [addPrincipal, setAddPrincipal] = useState("");
  const [addCapability, setAddCapability] = useState<Capability>("editor");

  const grantedUserIds = new Set(grants.map((g) => g.user_id).filter(Boolean));
  const grantedTeamIds = new Set(grants.map((g) => g.team_id).filter(Boolean));

  // Add candidates: teams the caller coaches and teammates, each not already on the list. The caller may add
  // themselves: when they own it only through a team grant (or admin), a direct user grant is meaningful.
  const teamOptions = coachedTeams
    .filter((t) => !grantedTeamIds.has(t.teamId))
    .map((t) => ({ value: `team:${t.teamId}`, label: `${t.teamName} (team)` }));
  const userOptions = [...profiles.values()]
    .filter((p) => !grantedUserIds.has(p.id))
    .map((p) => ({ value: `user:${p.id}`, label: p.display_name || p.email || p.id }));
  const addOptions = [{ value: "", label: "Add a person or team…" }, ...teamOptions, ...userOptions];

  const add = () => {
    if (!addPrincipal) return;

    const [kind, id] = addPrincipal.split(":");

    setAddPrincipal("");
    onAdd(kind as "user" | "team", id, addCapability);
  };

  return (
    <section className="flex flex-col gap-3">
      <span className={PANEL_TITLE}>Who has access</span>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {grants.map((grant) => {
          const own = grant.user_id === currentUserId;

          return (
            <li key={grant.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm">
                {principalName(grant, profiles, teamName)}
                {own && <span className={MUTED}> (you)</span>}
              </span>
              <Select
                ariaLabel={`Capability for ${principalName(grant, profiles, teamName)}`}
                value={grant.capability}
                options={CAPABILITY_OPTIONS}
                onValueChange={(value) => onChangeCapability(grant, value as Capability)}
              />
              <IconButton
                variant="control"
                aria-label={own ? `Leave this ${entityNoun}` : "Remove access"}
                onClick={() => onRemove(grant)}
              >
                <Trash2 size={16} aria-hidden="true" />
              </IconButton>
            </li>
          );
        })}
      </ul>

      {addOptions.length > 1 && (
        <Field label="Add access">
          <div className="flex gap-2">
            <Select
              ariaLabel="Add a person or team"
              value={addPrincipal}
              options={addOptions}
              onValueChange={setAddPrincipal}
            />
            <Select
              ariaLabel="Capability"
              value={addCapability}
              options={CAPABILITY_OPTIONS}
              onValueChange={(value) => setAddCapability(value as Capability)}
            />
            <Button onClick={add} disabled={!addPrincipal}>
              Add
            </Button>
          </div>
        </Field>
      )}

      {children}

      {error && <p className="m-0 text-sm text-danger">{error}</p>}
    </section>
  );
}
