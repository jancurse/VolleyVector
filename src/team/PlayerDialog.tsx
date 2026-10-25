import { useState } from "react";
import type { FormEvent, JSX } from "react";

import type { PlayerDraft } from "../games/useRoster";
import { POSITION_OPTIONS } from "../games/format";
import { secondaryOf } from "../games/rotation";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { ToggleGroup } from "../ui/ToggleGroup";

// Mounted per open, so each opening starts from the given player (or a blank one).
type PlayerDialogProps = {
  title: string;
  initial: PlayerDraft;
  onSave: (draft: PlayerDraft) => Promise<{ error: string | null }>;
  onClose: () => void;
};

export function PlayerDialog({ title, initial, onSave, onClose }: PlayerDialogProps): JSX.Element {
  const [number, setNumber] = useState(Number.isNaN(initial.number) ? "" : String(initial.number));
  const [name, setName] = useState(initial.name);
  const [shortName, setShortName] = useState(initial.shortName);
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

    const result = await onSave({ number: parsed, name: name.trim(), shortName: shortName.trim(), main, secondary });

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
        <Field label="Short name">
          <Input
            value={shortName}
            placeholder={name || "Shown on the slips"}
            onChange={(e) => setShortName(e.target.value)}
          />
        </Field>
        <Field label="Main position">
          <Select
            ariaLabel="Main position"
            value={main}
            options={POSITION_OPTIONS}
            onValueChange={(v) => {
              setMain(v as typeof main);
              setSecondary(secondaryOf(secondary, v as typeof main));
            }}
          />
        </Field>
        <Field label="Also plays">
          <ToggleGroup
            multiple
            variant="pills"
            ariaLabel="Also plays"
            items={POSITION_OPTIONS.filter((o) => o.value !== main)}
            value={secondary}
            onValueChange={(v) => setSecondary(secondaryOf(v, main))}
          />
        </Field>
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
