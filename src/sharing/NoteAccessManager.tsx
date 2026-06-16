import { useEffect, useState } from "react";
import type { JSX } from "react";
import { Trash2 } from "lucide-react";

import type { Capability } from "../supabase/rows";
import type { AccessRow } from "../supabase/rows";
import { supabase } from "../supabase/client";
import { subtreeIds } from "../notes/operations";
import type { Note } from "../notes/types";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { Select } from "../ui/Select";
import { MUTED, PANEL_TITLE } from "../ui/styles";
import type { TeamRef } from "../workspace/useWorkspace";

// The owner's access manager for one note, sharing its whole subtree at once. A note is a document and a tree
// node; sharing applies to the note and every subnote beneath it, so a grant is written per node (reads stay
// non-recursive) and surfaces the subtree at the target team's top level. Add a teammate or a team you coach,
// change a grant's capability, remove a grant, or leave. RLS enforces the same rules server-side.
type NoteAccessManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The root note whose subtree is shared. */
  note: Note;
  /** The full note tree, to resolve the root's subtree. */
  notes: readonly Note[];
  /** Teams the caller may grant to (the teams they coach). */
  coachedTeams: readonly TeamRef[];
  /** Resolve any team's name (a grant may name a team the caller does not coach). */
  teamName: (teamId: string) => string;
  currentUserId: string;
};

type Profile = { id: string; display_name: string | null; email: string | null };

type AccessData = { grants: AccessRow[]; profiles: Map<string, Profile>; error: string | null };

/** The root note's access list and the profiles needed to name its user grants. Every subtree node carries
 *  the same grants, so the root is representative. */
async function fetchAccess(rootId: string): Promise<AccessData> {
  const [grantsR, profilesR] = await Promise.all([
    supabase.from("topic_access").select("id, user_id, team_id, capability").eq("topic_id", rootId),
    supabase.from("profiles").select("id, display_name, email"),
  ]);

  if (grantsR.error) return { grants: [], profiles: new Map(), error: grantsR.error.message };

  return {
    grants: (grantsR.data ?? []) as AccessRow[],
    profiles: new Map(((profilesR.data ?? []) as Profile[]).map((p) => [p.id, p])),
    error: null,
  };
}

const CAPABILITY_OPTIONS = [
  { value: "viewer", label: "Viewer" },
  { value: "editor", label: "Editor" },
  { value: "owner", label: "Owner" },
];

function principalName(grant: AccessRow, profiles: Map<string, Profile>, teamName: (id: string) => string): string {
  if (grant.team_id) return `${teamName(grant.team_id)} (team)`;

  const profile = grant.user_id ? profiles.get(grant.user_id) : undefined;

  return profile?.display_name || profile?.email || "Unknown user";
}

export function NoteAccessManager({
  open,
  onOpenChange,
  note,
  notes,
  coachedTeams,
  teamName,
  currentUserId,
}: NoteAccessManagerProps): JSX.Element {
  const [grants, setGrants] = useState<AccessRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [addPrincipal, setAddPrincipal] = useState("");
  const [addCapability, setAddCapability] = useState<Capability>("editor");

  // Sharing writes one grant per node in the note's subtree, so reads (which select by the space's principal)
  // never need to walk the tree.
  const ids = subtreeIds(notes, note.id);

  const apply = (data: AccessData) => {
    setError(data.error);
    setGrants(data.grants);
    setProfiles(data.profiles);
  };

  useEffect(() => {
    if (!open) return;

    let active = true;

    void fetchAccess(note.id).then((data) => active && apply(data));

    return () => {
      active = false;
    };
  }, [open, note.id]);

  const run = async (op: PromiseLike<{ error: { message: string } | null }>) => {
    const { error: writeError } = await op;

    if (writeError) setError(writeError.message);
    else apply(await fetchAccess(note.id));
  };

  const grantedUserIds = new Set(grants.map((g) => g.user_id).filter(Boolean));
  const grantedTeamIds = new Set(grants.map((g) => g.team_id).filter(Boolean));

  // Add candidates: teams the caller coaches and teammates, each not already on the list. The caller may add
  // themselves: when they own a note only through a team grant (or admin), a direct user grant is meaningful.
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
    const rows = ids.map((topicId) => ({
      topic_id: topicId,
      user_id: kind === "team" ? null : id,
      team_id: kind === "team" ? id : null,
      capability: addCapability,
    }));

    setAddPrincipal("");
    void run(supabase.from("topic_access").insert(rows));
  };

  // A capability change or a removal targets one principal across the whole subtree.
  const byPrincipal = (op: "update" | "delete", grant: AccessRow, capability?: Capability) => {
    const base =
      op === "update"
        ? supabase.from("topic_access").update({ capability }).in("topic_id", ids)
        : supabase.from("topic_access").delete().in("topic_id", ids);

    return grant.team_id ? base.eq("team_id", grant.team_id) : base.eq("user_id", grant.user_id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Manage access">
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
                  onValueChange={(value) => void run(byPrincipal("update", grant, value as Capability))}
                />
                <IconButton
                  variant="control"
                  aria-label={own ? "Leave this note" : "Remove access"}
                  onClick={() => void run(byPrincipal("delete", grant))}
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

        <span className={MUTED}>Sharing applies to this note and all its subnotes.</span>

        {error && <p className="m-0 text-sm text-danger">{error}</p>}
      </section>
    </Dialog>
  );
}
