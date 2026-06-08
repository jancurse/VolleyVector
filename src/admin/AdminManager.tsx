import { useState } from "react";
import type { JSX } from "react";

import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { PANEL_TITLE } from "../ui/styles";

// The admin panel: concerns that span teams rather than living inside one. Reached from the header by
// a global admin only. Today it creates teams (a plain insert an admin's RLS allows); it is the home
// for further cross-team and account management as that grows.
type AdminManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTeam: (name: string) => Promise<string | null>;
};

export function AdminManager({ open, onOpenChange, onCreateTeam }: AdminManagerProps): JSX.Element {
  const [newTeam, setNewTeam] = useState("");
  const [createStatus, setCreateStatus] = useState<string | null>(null);

  const create = async () => {
    if (newTeam.trim() === "") return;

    const created = newTeam.trim();

    if (await onCreateTeam(created)) {
      setCreateStatus(`Created ${created}`);
      setNewTeam("");
    }
  };

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
    </Dialog>
  );
}
