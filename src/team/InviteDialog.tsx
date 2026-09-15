import { useEffect, useState } from "react";
import type { JSX } from "react";

import { createInvite, inviteAvailability, sendEmailInvite } from "../invites/invites";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { ToggleGroup } from "../ui/ToggleGroup";
import { MUTED } from "../ui/styles";
import { useCopyLabel } from "../ui/useCopyLabel";
import type { TeamRole } from "../workspace/useWorkspace";

// The one invite surface, reached two ways: a team's "Invite member" button (the team fixed, role chosen
// here) or the sidebar's Invite entry (no team, an optional team picker). A top-level method picks how the
// person is invited. By link mints a link typed from three independent grants — create an account (the
// only quota-consuming one), join a team, and (admins only) grant invite quota — usable once or by a set
// number of people, so a coach can onboard a whole team from one link. Every grant applies per redeemer,
// and every use of an account-creation link costs a quota slot. By email sends that same server-side
// invite as a single-use link, into the chosen team or team-less. Both run server-side; this only
// collects inputs.
export type InviteTeam = { teamId: string; teamName: string };

type InviteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog is scoped to this team (the team is fixed; the role is chosen here). */
  team?: InviteTeam | null;
  /** Teams the user may invite into, offered in the picker when no team is fixed. */
  teams?: readonly InviteTeam[];
  isAdmin: boolean;
  currentUserId: string;
};

const ROLE_OPTIONS = [
  { value: "coach", label: "Coach" },
  { value: "player", label: "Player" },
];

const NO_TEAM = "";

/** The server's own ceiling on a link's uses, mirrored here so the field cannot ask for a rejected mint. */
const MAX_USES_LIMIT = 1000;

const invitesLeft = (n: number) => `${n} ${n === 1 ? "invite" : "invites"} left.`;

export function InviteDialog({
  open,
  onOpenChange,
  team = null,
  teams = [],
  isAdmin,
  currentUserId,
}: InviteDialogProps): JSX.Element {
  // null until loaded; an admin reads null (unlimited) and is never gated.
  const [available, setAvailable] = useState<number | null>(null);
  const [method, setMethod] = useState<"link" | "email">("link");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [teamId, setTeamId] = useState<string>(team?.teamId ?? NO_TEAM);
  const [role, setRole] = useState<TeamRole>("player");
  const [uses, setUses] = useState("1");
  const [bonus, setBonus] = useState("0");
  const [link, setLink] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { copied, copy, reset: resetCopied } = useCopyLabel();

  // Load the caller's remaining invites fresh each open, so the count stays live across mints in a session.
  useEffect(() => {
    if (!open) return;

    let active = true;

    void inviteAvailability().then(({ available: a }) => {
      if (active) setAvailable(a);
    });

    return () => {
      active = false;
    };
  }, [open]);

  // Closing clears the transient state, so the next invite opens on a clean slate with no stale output.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setMethod("link");
      setMode("new");
      setTeamId(team?.teamId ?? NO_TEAM);
      setRole("player");
      setUses("1");
      setBonus("0");
      setLink(null);
      setEmail("");
      setSent(null);
      setError(null);
      setBusy(false);
      resetCopied();
    }

    onOpenChange(next);
  };

  // Switching method drops the other method's output, so a stale link or sent notice never lingers.
  const switchMethod = (next: "link" | "email") => {
    setMethod(next);
    setLink(null);
    setSent(null);
    setError(null);
    resetCopied();
  };

  const canCreateAccount = isAdmin || (available !== null && available >= 1);
  const allowsNewAccount = mode === "new" && canCreateAccount;
  const grantQuota = isAdmin ? Math.max(0, Math.trunc(Number(bonus)) || 0) : 0;
  const maxUses = Math.min(MAX_USES_LIMIT, Math.max(1, Math.trunc(Number(uses)) || 1));
  const joinsTeam = teamId !== NO_TEAM;
  // A link that grants nothing is not worth minting.
  const grantsNothing = !allowsNewAccount && !joinsTeam && grantQuota <= 0;
  // Every use of an account-creation link reserves a slot, so the whole link must fit the quota at mint.
  const overQuota = allowsNewAccount && !isAdmin && available !== null && maxUses > available;

  const make = async () => {
    setBusy(true);
    setError(null);
    setLink(null);
    resetCopied();

    const { url, error: failure } = await createInvite({
      createdBy: currentUserId,
      allowsNewAccount,
      grantQuota,
      teamId: joinsTeam ? teamId : null,
      role: joinsTeam ? role : null,
      maxUses,
    });

    setBusy(false);

    if (failure) {
      setError(failure);

      return;
    }

    setLink(url);
    // Minting an account-creation link reserved its uses; refresh the live count for a non-admin.
    if (allowsNewAccount && !isAdmin) void inviteAvailability().then(({ available: a }) => setAvailable(a));
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    setSent(null);

    const address = email.trim();
    const { error: failure } = await sendEmailInvite(address, joinsTeam ? teamId : null, joinsTeam ? role : null);

    setBusy(false);

    if (failure) {
      setError(failure);

      return;
    }

    setSent(address);
    // The email send spent a slot; refresh the live count for a non-admin so the quota note and Send button
    // do not go stale.
    if (!isAdmin) void inviteAvailability().then(({ available: a }) => setAvailable(a));
  };

  const copyLink = () => {
    if (link) copy(link);
  };

  // Only relevant to a non-admin who will create an account (a "new person" link or any email invite): how
  // many slots remain, or why the option is off. An admin is unlimited; an existing-user link skips quota.
  const wantsAccount = method === "email" || allowsNewAccount;
  const quotaNote =
    isAdmin || available === null
      ? null
      : available === 0
        ? "No invites left."
        : wantsAccount
          ? `${overQuota ? "Only " : ""}${invitesLeft(available)}`
          : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} title={team ? `Invite to ${team.teamName}` : "Invite"}>
      <Field label="Invite by">
        <div>
          <ToggleGroup
            ariaLabel="How to invite"
            value={method}
            onValueChange={(next) => switchMethod(next === "email" ? "email" : "link")}
            items={[
              { value: "link", label: "By link" },
              { value: "email", label: "By email" },
            ]}
          />
        </div>
      </Field>

      <div className="flex flex-col gap-1.5">
        {method === "link" ? (
          <Field label="Link type">
            <div>
              <ToggleGroup
                ariaLabel="Who the link is for"
                value={allowsNewAccount ? "new" : "existing"}
                onValueChange={(next) => setMode(next === "new" ? "new" : "existing")}
                items={[
                  { value: "new", label: "New person", disabled: !canCreateAccount },
                  { value: "existing", label: "Existing user" },
                ]}
              />
            </div>
          </Field>
        ) : (
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
            />
          </Field>
        )}
        {quotaNote && <span className={MUTED}>{quotaNote}</span>}
      </div>

      {(!team || joinsTeam) && (
        <div className="flex flex-wrap items-start gap-4">
          {!team && (
            <div className="w-52">
              <Field label="Team">
                <Select
                  ariaLabel="Invite team"
                  value={teamId}
                  onValueChange={setTeamId}
                  options={[
                    { value: NO_TEAM, label: "No team" },
                    ...teams.map((t) => ({ value: t.teamId, label: t.teamName })),
                  ]}
                />
              </Field>
            </div>
          )}
          {joinsTeam && (
            <div className="w-32">
              <Field label="Role">
                <Select
                  ariaLabel="Invite role"
                  value={role}
                  options={ROLE_OPTIONS}
                  onValueChange={(next) => setRole(next === "coach" ? "coach" : "player")}
                />
              </Field>
            </div>
          )}
        </div>
      )}

      {method === "link" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-start gap-4">
            <div className="w-28">
              <Field label="Uses">
                <Input
                  type="number"
                  min={1}
                  max={MAX_USES_LIMIT}
                  value={uses}
                  onChange={(event) => setUses(event.target.value)}
                  aria-label="How many people may use the link"
                />
              </Field>
            </div>
            {isAdmin && (
              <div className="w-28">
                <Field label="Bonus invites">
                  <Input
                    type="number"
                    min={0}
                    value={bonus}
                    onChange={(event) => setBonus(event.target.value)}
                    aria-label="Bonus invites to grant"
                  />
                </Field>
              </div>
            )}
          </div>
          {maxUses > 1 && grantQuota > 0 && (
            <span className={MUTED}>
              Each person who joins gets {grantQuota} {grantQuota === 1 ? "invite" : "invites"}.
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {method === "link" ? (
          <>
            <Button className="self-start" onClick={() => void make()} disabled={busy || grantsNothing || overQuota}>
              {busy ? "Creating…" : "Create invite link"}
            </Button>
            {link && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <Input readOnly value={link} aria-label="Invite link" onFocus={(event) => event.target.select()} />
                  <Button variant="ghost" onClick={copyLink}>
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <span className={MUTED}>
                  {maxUses === 1 ? "Single-use" : `Usable ${maxUses} times`}, expires in 7 days.
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <Button
              className="self-start"
              onClick={() => void send()}
              disabled={busy || !email.trim() || !canCreateAccount}
            >
              {busy ? "Sending…" : "Send invite"}
            </Button>
            {sent && <p className="m-0 text-sm text-text">Invite sent to {sent}.</p>}
          </>
        )}
        {error && <p className="m-0 text-sm text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}
