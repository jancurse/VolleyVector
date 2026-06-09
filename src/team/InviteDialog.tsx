import { useState } from "react";
import type { JSX } from "react";

import { useAuth } from "../auth/useAuth";
import { createInvite } from "../invites/invites";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { MUTED } from "../ui/styles";
import type { TeamRole } from "../workspace/useWorkspace";

// The one invite surface, opened from the team menu so the roster stays uncluttered. A coach picks a role
// and mints a single-use link to share through any channel; redeeming runs server-side, this only collects
// the inputs. Inviting by email is hidden for now: it relies on Supabase's built-in sender, which is
// rate-limited and unusable for real invites until custom SMTP is configured. The `invite` Edge Function
// and `inviteMember` helper stay in place for when it is restored.
type InviteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string | null;
  teamName: string;
};

const ROLE_OPTIONS = [
  { value: "coach", label: "Coach" },
  { value: "player", label: "Player" },
];

export function InviteDialog({ open, onOpenChange, teamId, teamName }: InviteDialogProps): JSX.Element {
  const { user } = useAuth();

  const [role, setRole] = useState<TeamRole>("player");
  const [link, setLink] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy");

  // Closing clears the transient state, so the next invite opens on a clean slate with no stale link.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setRole("player");
      setLink(null);
      setLinkError(null);
      setCopyLabel("Copy");
    }

    onOpenChange(next);
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

      <div className="flex flex-col gap-3 pt-1">
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
      </div>
    </Dialog>
  );
}
