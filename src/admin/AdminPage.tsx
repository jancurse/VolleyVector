import { useMemo, useState } from "react";
import type { JSX } from "react";
import { Search } from "lucide-react";

import type { AdminSub } from "../routing/route";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Tab, TabList, TabPanel, Tabs } from "../ui/Tabs";
import { Table, TableCell, TableHeadCell } from "../ui/Table";
import { cx, EYEBROW, MUTED, PAGE, PAGE_BAR, PANEL, PANEL_TITLE, TITLE } from "../ui/styles";
import { useConfirm } from "../ui/useConfirm";
import type { AdminProfile, AdminTeam, TeamState } from "./useAdmin";
import { useAdmin } from "./useAdmin";

// The admin area: concerns that span teams rather than living inside one. A dedicated sidebar entry,
// visible only to a global admin, opens it. Three sub-pages share one `useAdmin` snapshot and render as
// tables: Teams (create, archive, delete), Accounts (delete non-admin accounts), and Recovery (restore
// grace-archived teams, accounts, boards, and notes). RLS has the final say on every write.
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

// Case-insensitive A→Z, the order both admin tables and the recovery groups sort by.
const byLabel = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

function StateBadge({ state }: { state: TeamState }): JSX.Element {
  return (
    <span className={cx("font-mono text-2xs font-medium uppercase tracking-[0.16em]", STATE_COLOR[state])}>
      {STATE_LABEL[state]}
    </span>
  );
}

// A live text filter heading a table: a search-icon input that narrows the rows as the admin types.
function FilterField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}): JSX.Element {
  return (
    <div className="relative max-w-xs">
      <Search
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim"
      />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-8"
      />
    </div>
  );
}

// An account's invite quota: a compact number field that commits on Set. Account creation is the only
// quota-gated action; raising a quota is the one way to expand onboarding capacity, and only an admin can.
function QuotaCell({ value, onSet }: { value: number; onSet: (next: number) => void }): JSX.Element {
  const [text, setText] = useState(String(value));
  const [committed, setCommitted] = useState(value);

  // Reseed when the stored value changes (after a reload commits a new quota): the render-time
  // adjustment React recommends over an effect.
  if (committed !== value) {
    setCommitted(value);
    setText(String(value));
  }

  const parsed = Math.max(0, Math.trunc(Number(text)) || 0);

  return (
    <span className="flex items-center justify-end gap-2">
      <span className="inline-block w-16">
        <Input
          type="number"
          min={0}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="text-right"
          aria-label="Invite quota"
        />
      </span>
      <Button variant="ghost" size="sm" disabled={parsed === value} onClick={() => onSet(parsed)}>
        Set
      </Button>
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

  const sorted = [...items].sort((a, b) => byLabel(a.label, b.label));

  return (
    <div className="flex max-w-2xl flex-col gap-2">
      <span className={PANEL_TITLE}>{title}</span>
      <Table width="fill">
        <tbody>
          {sorted.map((item) => (
            <tr key={item.id}>
              <TableCell className="max-w-0 truncate">{item.label}</TableCell>
              <TableCell className="w-28 text-right">
                <Button variant="ghost" size="sm" onClick={() => onRestore(item.id)}>
                  Restore
                </Button>
              </TableCell>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function AdminPage({ sub, onNavigateSub, onCreateTeam, currentUserId }: AdminPageProps): JSX.Element {
  const admin = useAdmin(true);
  const { confirm, dialog } = useConfirm();
  const [newTeam, setNewTeam] = useState("");
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");

  const create = async () => {
    if (newTeam.trim() === "") return;

    const created = newTeam.trim();

    setActionError(null);

    if (await onCreateTeam(created)) {
      setCreateStatus(`Created ${created}`);
      setNewTeam("");
      admin.reload();
    } else {
      setActionError(`Could not create ${created}.`);
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

  const liveTeams = useMemo(
    () => admin.teams.filter((t) => t.state !== "deleted").sort((a, b) => byLabel(a.name, b.name)),
    [admin.teams]
  );
  const deletedTeams = admin.teams.filter((t) => t.state === "deleted");
  const activeProfiles = useMemo(
    () => admin.profiles.filter((p) => !p.deletedAt).sort((a, b) => byLabel(a.email || a.id, b.email || b.id)),
    [admin.profiles]
  );
  const deletedProfiles = admin.profiles.filter((p) => p.deletedAt);

  const teamQuery = teamFilter.trim().toLowerCase();
  const shownTeams = teamQuery ? liveTeams.filter((t) => t.name.toLowerCase().includes(teamQuery)) : liveTeams;
  const accountQuery = accountFilter.trim().toLowerCase();
  const shownProfiles = accountQuery
    ? activeProfiles.filter((p) => (p.email || p.id).toLowerCase().includes(accountQuery))
    : activeProfiles;
  const hasRecovery =
    deletedTeams.length > 0 ||
    deletedProfiles.length > 0 ||
    admin.deletedBoards.length > 0 ||
    admin.deletedNotes.length > 0;

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
          <div className={cx(PANEL, "max-w-2xl gap-4")}>
            <span className={PANEL_TITLE}>New team</span>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Team name" className="max-w-xs flex-1">
                <Input
                  value={newTeam}
                  onChange={(event) => {
                    setNewTeam(event.target.value);
                    setCreateStatus(null);
                  }}
                />
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
            <div className="flex flex-col gap-4">
              <FilterField value={teamFilter} onChange={setTeamFilter} placeholder="Filter teams…" />
              {shownTeams.length === 0 ? (
                <p className={MUTED}>No teams match “{teamFilter.trim()}”.</p>
              ) : (
                <Table width="fill">
                  <thead>
                    <tr>
                      <TableHeadCell>Team</TableHeadCell>
                      <TableHeadCell className="w-28">State</TableHeadCell>
                      <TableHeadCell className="w-48">
                        <span className="sr-only">Actions</span>
                      </TableHeadCell>
                    </tr>
                  </thead>
                  <tbody>
                    {shownTeams.map((team) => (
                      <tr key={team.id}>
                        <TableCell className="max-w-0 truncate">{team.name}</TableCell>
                        <TableCell>
                          <StateBadge state={team.state} />
                        </TableCell>
                        <TableCell className="text-right">
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
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          )}
        </TabPanel>

        <TabPanel value="accounts">
          {admin.loading ? (
            <p className={MUTED}>Loading…</p>
          ) : activeProfiles.length === 0 ? (
            <p className={MUTED}>No accounts.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <FilterField value={accountFilter} onChange={setAccountFilter} placeholder="Filter accounts…" />
              {shownProfiles.length === 0 ? (
                <p className={MUTED}>No accounts match “{accountFilter.trim()}”.</p>
              ) : (
                <Table width="fill">
                  <thead>
                    <tr>
                      <TableHeadCell>Account</TableHeadCell>
                      <TableHeadCell className="w-44 text-right">Invites</TableHeadCell>
                      <TableHeadCell className="w-48">
                        <span className="sr-only">Actions</span>
                      </TableHeadCell>
                    </tr>
                  </thead>
                  <tbody>
                    {shownProfiles.map((profile) => (
                      <tr key={profile.id}>
                        <TableCell className="max-w-0">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate">{profile.email || profile.id}</span>
                            {profile.id === currentUserId && <span className={TAG}>You</span>}
                          </span>
                        </TableCell>
                        <TableCell>
                          <QuotaCell
                            value={profile.inviteQuota}
                            onSet={(value) => void act(admin.setInviteQuota(profile.id, value))}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {profile.isAdmin ? (
                            <span className={cx(TAG, "text-accent")}>Admin</span>
                          ) : (
                            <Button variant="danger" size="sm" onClick={() => void confirmDeleteAccount(profile)}>
                              Delete account
                            </Button>
                          )}
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
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
                title="Notes"
                items={admin.deletedNotes.map((i) => ({ id: i.id, label: i.title || "Untitled" }))}
                onRestore={(id) => void act(admin.restoreNote(id))}
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
