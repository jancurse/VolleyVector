import { useState } from "react";
import type { FormEvent, JSX } from "react";

import { ROLES } from "../court/roles";
import type { PlayerDraft } from "../games/useRoster";
import { POSITIONS } from "../games/types";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

// Add a roster player or edit one: jersey number, name, main position, and an optional secondary position.
// Mounted per open, so each opening starts from the given player (or a blank one).
type PlayerDialogProps = {
  title: string;
  initial: PlayerDraft;
  onSave: (draft: PlayerDraft) => Promise<{ error: string | null }>;
  onClose: () => void;
};

const POSITION_OPTIONS = POSITIONS.map((p) => ({ value: p, label: ROLES[p].name }));

export function PlayerDialog({ title, initial, onSave, onClose }: PlayerDialogProps): JSX.Element {
  const [number, setNumber] = useState(Number.isNaN(initial.number) ? "" : String(initial.number));
  const [name, setName] = useState(initial.name);
  const [main, setMain] = useState(initial.main);
  const [secondary, setSecondary] = useState(initial.secondary);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsed = Number(number);
  const valid = number.trim() !== "" && Number.isInteger(parsed) && parsed >= 0 && parsed <= 99;

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    if (!valid) return;

    setSaving(true);

    const result = await onSave({ number: parsed, name: name.trim(), main, secondary });

    setSaving(false);

    if (result.error) setError(result.error);
    else onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={title}>
      <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
        <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
          <Field label="Number">
            <Input inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} autoFocus />
          </Field>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Main position">
            <Select
              ariaLabel="Main position"
              value={main}
              options={POSITION_OPTIONS}
              onValueChange={(v) => setMain(v as typeof main)}
            />
          </Field>
          <Field label="Secondary position">
            <Select
              ariaLabel="Secondary position"
              value={secondary ?? ""}
              options={[{ value: "", label: "None" }, ...POSITION_OPTIONS.filter((o) => o.value !== main)]}
              onValueChange={(v) => setSecondary(v === "" ? null : (v as typeof main))}
            />
          </Field>
        </div>
        {error && <p className="m-0 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" paired onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!valid || saving}>
            Save player
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
