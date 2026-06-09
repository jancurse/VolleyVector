import { useState } from "react";
import type { JSX } from "react";

import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { cx, MUTED, PANEL_TITLE } from "../ui/styles";
import { useConfirm } from "../ui/useConfirm";
import type { AdminProfile, AdminTeam, DeletedItem, TeamState } from "./useAdmin";
import { useAdmin } from "./useAdmin";

// The admin panel: concerns that span teams rather than living inside one. Reached from the header by a
// global admin only. It creates teams, manages each live team's lifecycle (archive, delete), deletes
// non-admin accounts, and — in one Recently-deleted section — recovers what was removed: deleted teams and
// accounts (restored as a unit) and individually deleted boards/topics. Account deletion is a soft-delete
// with a 3-month recovery window; team content a deleted account authored is the team's and is not listed
// here. RLS has the final say on every write.
type AdminManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTeam: (name: string) => Promise<string | null>;
  currentUserId: string;
};

const STATE_LABEL: Record<TeamState, string> = { active: "Active", archived: "Archived", deleted: "Deleted" };
const STATE_COLOR: Record<TeamState, string> = {
  active: "text-text-dim",
  archived: "text-accent",
  deleted: "text-danger",
};

function StateBadge({ state }: { state: TeamState }): JSX.Element {
  return (
    <span className={cx("font-mono text-2xs font-medium uppercase tracking-[0.16em]", STATE_COLOR[state])}>
      {STATE_LABEL[state]}
    </span>
  );
}

// One recovery row: a label, a small kind tag, and a Restore action. Shared by deleted teams, accounts, and
// boards/topics.
function RecoveryRow({ label, kind, onRestore }: { label: string; kind: string; onRestore: () => void }): JSX.Element {
  return (
    <li className="flex items-center justify-between gap-3 text-base">
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="truncate">{label}</span>
        <span className="shrink-0 font-mono text-2xs uppercase tracking-[0.16em] text-text-dim">{kind}</span>
      </span>
      <Button variant="ghost" size="sm" onClick={onRestore}>
        Restore
      </Button>
    </li>
  );
}

export function AdminManager({ open, onOpenChange, onCreateTeam, currentUserId }: AdminManagerProps): JSX.Element {
  const admin = useAdmin(open);
  const { confirm, dialog } = useConfirm();
  const [newTeam, setNewTeam] = useState("");
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const create = async () => {
    if (newTeam.trim() === "") return;

    const created = newTeam.trim();

    if (await onCreateTeam(created)) {
      setCreateStatus(`Created ${created}`);
      setNewTeam("");
      admin.reload();
    }
  };

  const act = async (op: Promise<{ error: string | null }>) => {
    setActionError(null);

    const { error } = await op;

    if (error) setActionError(error);
  };

  const confirmDeleteTeam = async (team: AdminTeam) => {
    const ok = await confirm({
      title: `Delete ${team.name}?`,
      description:
        "The team and its content are hidden for 3 months, then permanently removed. Restore it before then to undo.",
      confirmLabel: "Delete team",
      danger: true,
    });

    if (ok) void act(admin.deleteTeam(team.id));
  };

  const confirmDeleteAccount = async (profile: AdminProfile) => {
    const ok = await confirm({
      title: `Delete ${profile.email || "this account"}?`,
      description:
        "The account is disabled and recoverable for 3 months, then permanently deleted. Team content they authored stays with the team.",
      confirmLabel: "Delete account",
      danger: true,
    });

    if (ok) void act(admin.removeAccount(profile.id));
  };

  const liveTeams = admin.teams.filter((t) => t.state !== "deleted");
  const deletedTeams = admin.teams.filter((t) => t.state === "deleted");
  const activeProfiles = admin.profiles.filter((p) => !p.deletedAt);
  const deletedProfiles = admin.profiles.filter((p) => p.deletedAt);
  const hasRecovery =
    deletedTeams.length > 0 ||
    deletedProfiles.length > 0 ||
    admin.deletedBoards.length > 0 ||
    admin.deletedTopics.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Admin">
      <section className="flex flex-col gap-2">
        <span className={PANEL_TITLE}>New team</span>
        <Field label="Team name">
          <Input value={newTeam} onChange={(event) => setNewTeam(event.target.value)} />
        </Field>
        <Button onClick={() => void create()} disabled={newTeam.trim() === ""}>
          Create team
        </Button>
        {createStatus && <p className="m-0 text-sm text-text-dim">{createStatus}</p>}
      </section>

      {admin.loading ? (
        <p className={MUTED}>Loading…</p>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <span className={PANEL_TITLE}>Teams</span>
            {liveTeams.length === 0 ? (
              <p className={MUTED}>No teams.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {liveTeams.map((team) => (
                  <li key={team.id} className="flex items-center justify-between gap-3 text-base">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate">{team.name}</span>
                      <StateBadge state={team.state} />
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      {team.state === "archived" ? (
                        <Button variant="ghost" size="sm" onClick={() => void act(admin.unarchiveTeam(team.id))}>
                          Unarchive
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => void act(admin.archiveTeam(team.id))}>
                          Archive
                        </Button>
                      )}
                      <Button variant="danger" size="sm" onClick={() => void confirmDeleteTeam(team)}>
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <span className={PANEL_TITLE}>Accounts</span>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {activeProfiles.map((profile) => (
                <li key={profile.id} className="flex items-center justify-between gap-3 text-base">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate">{profile.email || profile.id}</span>
                    {profile.id === currentUserId && (
                      <span className="font-mono text-2xs uppercase tracking-[0.16em] text-text-dim">You</span>
                    )}
                  </span>
                  {profile.isAdmin ? (
                    <span className="shrink-0 font-mono text-2xs uppercase tracking-[0.16em] text-accent">Admin</span>
                  ) : (
                    <Button variant="danger" size="sm" onClick={() => void confirmDeleteAccount(profile)}>
                      Delete account
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <span className={PANEL_TITLE}>Recently deleted</span>
            {!hasRecovery ? (
              <p className={MUTED}>Nothing to recover.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {deletedTeams.map((team) => (
                  <RecoveryRow
                    key={`team-${team.id}`}
                    label={team.name}
                    kind="Team"
                    onRestore={() => void act(admin.restoreTeam(team.id))}
                  />
                ))}
                {deletedProfiles.map((profile) => (
                  <RecoveryRow
                    key={`account-${profile.id}`}
                    label={profile.email || profile.id}
                    kind="Account"
                    onRestore={() => void act(admin.recoverAccount(profile.id))}
                  />
                ))}
                {admin.deletedBoards.map((item: DeletedItem) => (
                  <RecoveryRow
                    key={`board-${item.id}`}
                    label={item.title || "Untitled"}
                    kind="Board"
                    onRestore={() => void act(admin.restoreBoard(item.id))}
                  />
                ))}
                {admin.deletedTopics.map((item: DeletedItem) => (
                  <RecoveryRow
                    key={`topic-${item.id}`}
                    label={item.title || "Untitled"}
                    kind="Topic"
                    onRestore={() => void act(admin.restoreTopic(item.id))}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {(actionError ?? admin.error) && <p className="m-0 text-sm text-danger">{actionError ?? admin.error}</p>}
      {dialog}
    </Dialog>
  );
}
