import { useEffect, useState } from "react";
import type { JSX } from "react";
import { Trash2 } from "lucide-react";

import type { Board, Capability } from "../boards/types";
import { supabase } from "../supabase/client";
import type { AccessRow } from "../supabase/rows";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { Select } from "../ui/Select";
import { MUTED, PANEL_TITLE } from "../ui/styles";
import type { TeamRef } from "../workspace/useWorkspace";
import { fetchShareUrl } from "./share";

// The owner's access manager for one board: the grants on its access list (a user co-editing, or a team
// whose library it lives in), each at viewer, editor, or owner. Add a teammate or a team you coach, change a
// grant's capability, remove a grant, or copy the read-only link. RLS enforces the same rules server-side.
type AccessManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: Board;
  /** Teams the caller may grant to (the teams they coach). */
  coachedTeams: readonly TeamRef[];
  /** Resolve any team's name (a grant may name a team the caller does not coach). */
  teamName: (teamId: string) => string;
  currentUserId: string;
};

type Profile = { id: string; display_name: string | null; email: string | null };

type AccessData = { grants: AccessRow[]; profiles: Map<string, Profile>; error: string | null };

/** The board's access list and the profiles needed to name its user grants. */
async function fetchAccess(boardId: string): Promise<AccessData> {
  const [grantsR, profilesR] = await Promise.all([
    supabase.from("board_access").select("id, user_id, team_id, capability").eq("board_id", boardId),
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

export function AccessManager({
  open,
  onOpenChange,
  board,
  coachedTeams,
  teamName,
  currentUserId,
}: AccessManagerProps): JSX.Element {
  const [grants, setGrants] = useState<AccessRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [addPrincipal, setAddPrincipal] = useState("");
  const [addCapability, setAddCapability] = useState<Capability>("editor");
  const [linkLabel, setLinkLabel] = useState("Copy link");

  const apply = (data: AccessData) => {
    setError(data.error);
    setGrants(data.grants);
    setProfiles(data.profiles);
  };

  useEffect(() => {
    if (!open) return;

    let active = true;

    void fetchAccess(board.id).then((data) => active && apply(data));

    return () => {
      active = false;
    };
  }, [open, board.id]);

  const run = async (op: PromiseLike<{ error: { message: string } | null }>) => {
    const { error: writeError } = await op;

    if (writeError) setError(writeError.message);
    else apply(await fetchAccess(board.id));
  };

  const grantedUserIds = new Set(grants.map((g) => g.user_id).filter(Boolean));
  const grantedTeamIds = new Set(grants.map((g) => g.team_id).filter(Boolean));

  // Add candidates: teams the caller coaches and teammates, each not already on the list. The caller may add
  // themselves: when they own a board only through a team grant (or admin), a direct user grant is meaningful.
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
    const row = {
      board_id: board.id,
      user_id: kind === "team" ? null : id,
      team_id: kind === "team" ? id : null,
      capability: addCapability,
    };

    setAddPrincipal("");
    void run(supabase.from("board_access").insert(row));
  };

  const copyLink = async () => {
    const url = await fetchShareUrl(board.id);

    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setLinkLabel("Copied");
      window.setTimeout(() => setLinkLabel("Copy link"), 1500);
    } catch {
      // The clipboard call can reject (no permission or an insecure context); leave the label as is.
    }
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
                  onValueChange={(value) =>
                    void run(supabase.from("board_access").update({ capability: value }).eq("id", grant.id))
                  }
                />
                <IconButton
                  variant="control"
                  aria-label={own ? "Leave this board" : "Remove access"}
                  onClick={() => void run(supabase.from("board_access").delete().eq("id", grant.id))}
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

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => void copyLink()}>
            {linkLabel}
          </Button>
          <span className={MUTED}>Anyone with the link can view a shared board.</span>
        </div>

        {error && <p className="m-0 text-sm text-danger">{error}</p>}
      </section>
    </Dialog>
  );
}
