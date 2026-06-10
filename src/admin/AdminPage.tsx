import { useState } from "react";
import type { JSX } from "react";

import type { AdminSub } from "../routing/route";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Tab, TabList, TabPanel, Tabs } from "../ui/Tabs";
import {
  cx,
  EYEBROW,
  MUTED,
  PAGE,
  PAGE_BAR,
  PANEL,
  PANEL_TITLE,
  TABLE,
  TABLE_CELL,
  TABLE_FRAME,
  TABLE_HEAD_CELL,
  TITLE,
} from "../ui/styles";
import { useConfirm } from "../ui/useConfirm";
import type { AdminProfile, AdminTeam, TeamState } from "./useAdmin";
import { useAdmin } from "./useAdmin";

// The admin area: concerns that span teams rather than living inside one. A dedicated sidebar entry,
// visible only to a global admin, opens it. Three sub-pages share one `useAdmin` snapshot and render as
// tables: Teams (create, archive, delete), Accounts (delete non-admin accounts), and Recovery (restore
// grace-archived teams, accounts, boards, and topics). RLS has the final say on every write.
type AdminPageProps = {
  sub: AdminSub;
  onNavigateSub: (sub: AdminSub) => void;
  onCreateTeam: (name: string) => Promise<string | null>;
  currentUserId: string;
};

const STATE_LABEL: Record<TeamState, string> = { active: "Active", archived: "Archived", deleted: "Deleted" };
const STATE_COLOR: Record<TeamState, string> = {
  active: "text-text-dim",
  archived: "text-accent",
  deleted: "text-danger",
};

const TAG = "shrink-0 font-mono text-2xs font-medium uppercase tracking-[0.16em] text-text-dim";

function StateBadge({ state }: { state: TeamState }): JSX.Element {
  return (
    <span className={cx("font-mono text-2xs font-medium uppercase tracking-[0.16em]", STATE_COLOR[state])}>
      {STATE_LABEL[state]}
    </span>
  );
}

function RecoveryGroup({
  title,
  items,
  onRestore,
}: {
  title: string;
  items: readonly { id: string; label: string }[];
  onRestore: (id: string) => void;
}): JSX.Element | null {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className={PANEL_TITLE}>{title}</span>
      <div className={TABLE_FRAME}>
        <table className={TABLE}>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className={cx(TABLE_CELL, "max-w-0 truncate")}>{item.label}</td>
                <td className={cx(TABLE_CELL, "w-28 text-right")}>
                  <Button variant="ghost" size="sm" onClick={() => onRestore(item.id)}>
                    Restore
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminPage({ sub, onNavigateSub, onCreateTeam, currentUserId }: AdminPageProps): JSX.Element {
  const admin = useAdmin(true);
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
    <section className={PAGE}>
      <div className={PAGE_BAR}>
        <div>
          <p className={EYEBROW}>Admin</p>
          <h1 className={TITLE}>Administration</h1>
        </div>
      </div>

      <Tabs value={sub} onValueChange={(value) => onNavigateSub(value as AdminSub)} className="flex flex-col gap-6">
        <TabList ariaLabel="Admin sections">
          <Tab value="teams">Teams</Tab>
          <Tab value="accounts">Accounts</Tab>
          <Tab value="recovery">Recovery</Tab>
        </TabList>

        <TabPanel value="teams" className="flex flex-col gap-6">
          <div className={cx(PANEL, "gap-4")}>
            <span className={PANEL_TITLE}>New team</span>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Team name" className="max-w-xs flex-1">
                <Input value={newTeam} onChange={(event) => setNewTeam(event.target.value)} />
              </Field>
              <Button onClick={() => void create()} disabled={newTeam.trim() === ""}>
                Create team
              </Button>
            </div>
            {createStatus && <p className="m-0 text-sm text-text-dim">{createStatus}</p>}
          </div>

          {admin.loading ? (
            <p className={MUTED}>Loading…</p>
          ) : liveTeams.length === 0 ? (
            <p className={MUTED}>No teams yet.</p>
          ) : (
            <div className={TABLE_FRAME}>
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TABLE_HEAD_CELL}>Team</th>
                    <th className={cx(TABLE_HEAD_CELL, "w-28")}>State</th>
                    <th className={cx(TABLE_HEAD_CELL, "w-48")}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {liveTeams.map((team) => (
                    <tr key={team.id}>
                      <td className={cx(TABLE_CELL, "max-w-0 truncate")}>{team.name}</td>
                      <td className={TABLE_CELL}>
                        <StateBadge state={team.state} />
                      </td>
                      <td className={cx(TABLE_CELL, "text-right")}>
                        <div className="flex justify-end gap-1">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabPanel>

        <TabPanel value="accounts">
          {admin.loading ? (
            <p className={MUTED}>Loading…</p>
          ) : activeProfiles.length === 0 ? (
            <p className={MUTED}>No accounts.</p>
          ) : (
            <div className={TABLE_FRAME}>
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TABLE_HEAD_CELL}>Account</th>
                    <th className={cx(TABLE_HEAD_CELL, "w-48")}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeProfiles.map((profile) => (
                    <tr key={profile.id}>
                      <td className={cx(TABLE_CELL, "max-w-0")}>
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate">{profile.email || profile.id}</span>
                          {profile.id === currentUserId && <span className={TAG}>You</span>}
                        </span>
                      </td>
                      <td className={cx(TABLE_CELL, "text-right")}>
                        {profile.isAdmin ? (
                          <span className={cx(TAG, "text-accent")}>Admin</span>
                        ) : (
                          <Button variant="danger" size="sm" onClick={() => void confirmDeleteAccount(profile)}>
                            Delete account
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabPanel>

        <TabPanel value="recovery">
          {admin.loading ? (
            <p className={MUTED}>Loading…</p>
          ) : !hasRecovery ? (
            <p className={MUTED}>Nothing to recover.</p>
          ) : (
            <div className="flex flex-col gap-6">
              <RecoveryGroup
                title="Teams"
                items={deletedTeams.map((t) => ({ id: t.id, label: t.name }))}
                onRestore={(id) => void act(admin.restoreTeam(id))}
              />
              <RecoveryGroup
                title="Accounts"
                items={deletedProfiles.map((p) => ({ id: p.id, label: p.email || p.id }))}
                onRestore={(id) => void act(admin.recoverAccount(id))}
              />
              <RecoveryGroup
                title="Boards"
                items={admin.deletedBoards.map((i) => ({ id: i.id, label: i.title || "Untitled" }))}
                onRestore={(id) => void act(admin.restoreBoard(id))}
              />
              <RecoveryGroup
                title="Topics"
                items={admin.deletedTopics.map((i) => ({ id: i.id, label: i.title || "Untitled" }))}
                onRestore={(id) => void act(admin.restoreTopic(id))}
              />
            </div>
          )}
        </TabPanel>
      </Tabs>

      {(actionError ?? admin.error) && <p className="m-0 text-sm text-danger">{actionError ?? admin.error}</p>}
      {dialog}
    </section>
  );
}
