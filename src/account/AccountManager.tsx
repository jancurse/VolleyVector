import { useState } from "react";
import type { JSX } from "react";

import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { Input } from "../ui/Input";
import { FIELD_LABEL } from "../ui/styles";

const PENCIL_ICON = (
  <svg viewBox="0 0 24 24" width={15} height={15} aria-hidden="true">
    <path
      d="M4 20h4l10-10-4-4L4 16zM14.5 5.5l4 4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// The account panel: a user's own profile, reached from the header. The display name shows read-only
// with a pencil to switch into editing it (a plain update RLS allows on the user's own row, limited to
// display_name by the column grant). The sign-in email shows read-only beneath.
type AccountManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  displayName: string;
  onSave: (name: string) => Promise<{ error: string | null }>;
};

export function AccountManager({ open, onOpenChange, email, displayName, onSave }: AccountManagerProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);

  // Reset to the read-only view, the saved name, and no error each time the dialog opens.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setEditing(false);
      setName(displayName);
      setError(null);
    }
  }

  const save = async () => {
    if (name.trim() === "") return;

    setSaving(true);
    setError(null);

    const { error: failure } = await onSave(name);

    setSaving(false);

    if (failure) {
      setError(failure);

      return;
    }

    setEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Account">
      <section className="flex flex-col gap-4">
        {editing ? (
          <Field label="Name">
            <Input value={name} autoFocus autoComplete="name" onChange={(event) => setName(event.target.value)} />
            <div className="flex gap-2">
              <Button onClick={() => void save()} disabled={saving || name.trim() === ""}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setName(displayName);
                  setEditing(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </Field>
        ) : (
          <div className="flex flex-col gap-2">
            <span className={FIELD_LABEL}>Name</span>
            <div className="flex items-center gap-2">
              <span className="text-base text-text">{displayName}</span>
              <IconButton size="sm" variant="plain" aria-label="Change name" onClick={() => setEditing(true)}>
                {PENCIL_ICON}
              </IconButton>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className={FIELD_LABEL}>Email</span>
          <span className="font-mono text-base text-text-dim">{email}</span>
        </div>

        {error && <p className="m-0 text-sm text-danger">{error}</p>}
      </section>
    </Dialog>
  );
}
