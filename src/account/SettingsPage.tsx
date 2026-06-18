import { useState } from "react";
import type { JSX } from "react";
import { Pencil } from "lucide-react";

import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { Input } from "../ui/Input";
import { cx, EYEBROW, FIELD_LABEL, PAGE, PAGE_BAR, PANEL, TITLE } from "../ui/styles";

const PENCIL_ICON = <Pencil size={15} aria-hidden="true" />;

// The account settings page, reached from the avatar menu. The display name shows read-only with a pencil
// to switch into editing it (a plain update RLS allows on the user's own row, limited to display_name by
// the column grant). The sign-in email shows read-only beneath. Sign out stays in the avatar menu; the
// one-way Delete account lives here, behind its confirm dialog.
type SettingsPageProps = {
  email: string;
  displayName: string;
  onSave: (name: string) => Promise<{ error: string | null }>;
  onDeleteAccount: () => void;
};

export function SettingsPage({ email, displayName, onSave, onDeleteAccount }: SettingsPageProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <section className={PAGE}>
      <div className={PAGE_BAR}>
        <div>
          <p className={EYEBROW}>Account</p>
          <h1 className={TITLE}>Settings</h1>
        </div>
      </div>

      <div className={cx(PANEL, "max-w-[34rem] gap-6")}>
        {editing ? (
          <Field label="Name">
            <Input value={name} autoFocus autoComplete="name" onChange={(event) => setName(event.target.value)} />
            <div className="flex gap-2">
              <Button onClick={() => void save()} disabled={saving || name.trim() === ""}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                variant="ghost"
                paired
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
      </div>

      <div className={cx(PANEL, "max-w-[34rem] gap-3")}>
        <span className={FIELD_LABEL}>Delete account</span>
        <p className="m-0 text-sm text-text-dim">
          Permanently delete your account and the content only you can see. This can’t be undone.
        </p>
        <div>
          <Button variant="danger" onClick={onDeleteAccount}>
            Delete account
          </Button>
        </div>
      </div>
    </section>
  );
}
