import { useState } from "react";
import type { JSX } from "react";

import { useAuth } from "../auth/useAuth";
import { createInvite } from "../invites/invites";
import { inviteMember } from "../supabase/invite";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Tab, TabList, TabPanel, Tabs } from "../ui/Tabs";
import { MUTED } from "../ui/styles";
import type { TeamRole } from "../workspace/useWorkspace";

// The one invite surface, opened from the team menu so the roster stays uncluttered. A coach picks the
// role, then either emails an invite (the server creates the account and emails it) or mints a single-use
// link to share through any channel. Both paths run server-side; this only collects the inputs.
type InviteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string | null;
  teamName: string;
  /** Called after a successful email invite, so the roster can show the new member. */
  onInvited: () => void;
};

const ROLE_OPTIONS = [
  { value: "coach", label: "Coach" },
  { value: "player", label: "Player" },
];

export function InviteDialog({ open, onOpenChange, teamId, teamName, onInvited }: InviteDialogProps): JSX.Element {
  const { user } = useAuth();

  const [method, setMethod] = useState("email");
  const [role, setRole] = useState<TeamRole>("player");
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy");

  // Closing clears the transient state, so the next invite opens on a clean slate with no stale status
  // or link lingering from the last one.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setMethod("email");
      setRole("player");
      setEmail("");
      setInviteStatus(null);
      setLink(null);
      setLinkError(null);
      setCopyLabel("Copy");
    }

    onOpenChange(next);
  };

  const invite = async () => {
    if (!teamId || email.trim() === "") return;

    setInviting(true);
    setInviteStatus(null);

    const { error } = await inviteMember(email.trim(), teamId, role);

    setInviting(false);

    if (error) {
      setInviteStatus(error);

      return;
    }

    setInviteStatus(`Invited ${email.trim()}`);
    setEmail("");
    onInvited();
  };

  const makeLink = async () => {
    if (!teamId || !user) return;

    setCreatingLink(true);
    setLinkError(null);
    setLink(null);
    setCopyLabel("Copy");

    const { url, error } = await createInvite(teamId, role, user.id);

    setCreatingLink(false);

    if (error) {
      setLinkError(error);

      return;
    }

    setLink(url);
  };

  const copyLink = async () => {
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      setCopyLabel("Copied");
      window.setTimeout(() => setCopyLabel("Copy"), 1500);
    } catch {
      // The clipboard call can reject (no permission or an insecure context); leave the label as is.
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} title={`Invite to ${teamName}`}>
      <Field label="Role">
        <Select
          ariaLabel="Invite role"
          value={role}
          options={ROLE_OPTIONS}
          onValueChange={(next) => setRole(next === "coach" ? "coach" : "player")}
        />
      </Field>

      <Tabs value={method} onValueChange={setMethod}>
        <TabList ariaLabel="Invite method">
          <Tab value="email">By email</Tab>
          <Tab value="link">By link</Tab>
        </TabList>

        <TabPanel value="email" className="flex flex-col gap-3 pt-4">
          <p className={MUTED}>Email an invite. They set a password and join {teamName}.</p>
          <Field label="Email">
            <Input type="email" value={email} autoComplete="off" onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Button onClick={() => void invite()} disabled={inviting || email.trim() === ""}>
            {inviting ? "Inviting…" : "Send invite"}
          </Button>
          {inviteStatus && <p className="m-0 text-sm text-text-dim">{inviteStatus}</p>}
        </TabPanel>

        <TabPanel value="link" className="flex flex-col gap-3 pt-4">
          <p className={MUTED}>
            Create a single-use link to share anywhere. The first person to open it joins as the role above; it expires
            after 7 days.
          </p>
          <Button onClick={() => void makeLink()} disabled={creatingLink}>
            {creatingLink ? "Creating…" : "Create invite link"}
          </Button>
          {link && (
            <div className="flex items-center gap-2">
              <Input readOnly value={link} aria-label="Invite link" onFocus={(event) => event.target.select()} />
              <Button variant="ghost" onClick={() => void copyLink()}>
                {copyLabel}
              </Button>
            </div>
          )}
          {linkError && <p className="m-0 text-sm text-danger">{linkError}</p>}
        </TabPanel>
      </Tabs>
    </Dialog>
  );
}
