import { useState } from "react";
import type { JSX } from "react";

import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Select } from "../../ui/Select";
import { CALLOUT_WARN, MUTED, NET_CAPTION, NET_LINE, PANEL, PANEL_TITLE } from "../../ui/styles";
import { COURT_ROWS } from "./courtRows";

type LineupEditorProps = {
  players: readonly string[];
  lineup: readonly string[];
  libero: string;
  open: boolean;
  onOpen: () => void;
  onCancel: () => void;
  onSave: (lineup: string[], libero: string) => void;
};

/** Setting the starting lineup: a player for each of the six positions, plus an optional libero. */
export function LineupEditor({
  players,
  lineup,
  libero,
  open,
  onOpen,
  onCancel,
  onSave,
}: LineupEditorProps): JSX.Element {
  const [draft, setDraft] = useState<string[]>(lineup.length === 6 ? [...lineup] : ["", "", "", "", "", ""]);
  const [lib, setLib] = useState(libero);

  if (!open) {
    return (
      <section className={PANEL} aria-label="Lineup">
        <div className="flex items-center justify-between gap-2">
          <p className={MUTED}>Set the starting lineup to track who’s on court and who serves.</p>
          <Button variant="ghost" onClick={onOpen} disabled={players.length < 6}>
            Set lineup
          </Button>
        </div>
      </section>
    );
  }

  const chosen = [...draft, lib].filter(Boolean);
  const duplicate = chosen.length !== new Set(chosen).size;
  const valid = draft.every(Boolean) && !duplicate;
  const options = (none: string) => [{ value: "", label: none }, ...players.map((p) => ({ value: p, label: p }))];

  return (
    <section className={PANEL} aria-labelledby="lineup-title">
      <h2 id="lineup-title" className={PANEL_TITLE}>
        Starting lineup
      </h2>
      <p className="m-0 text-xs text-text-dim">
        Positions at the start of the set; position 1 serves. This applies to the whole set, so use substitutions for
        changes during play.
      </p>
      <div>
        <div className={NET_CAPTION}>net</div>
        <div className={`${NET_LINE} flex flex-col gap-1.5`}>
          {COURT_ROWS.map((row, r) => (
            <div key={r} className="grid grid-cols-3 gap-1.5">
              {row.map((pos) => (
                <Select
                  key={pos}
                  ariaLabel={`Position ${pos}`}
                  value={draft[pos - 1]}
                  onValueChange={(v) => setDraft((d) => d.map((x, i) => (i === pos - 1 ? v : x)))}
                  options={options(`P${pos}`)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <Field label="Libero">
        <Select ariaLabel="Libero" value={lib} onValueChange={setLib} options={options("None")} />
      </Field>
      {duplicate && <p className={CALLOUT_WARN}>Each player can only appear once.</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" paired onClick={onCancel}>
          Cancel
        </Button>
        {lineup.length === 6 && (
          <Button variant="danger" paired onClick={() => onSave([], "")}>
            Remove
          </Button>
        )}
        <Button onClick={() => onSave(draft, lib)} disabled={!valid}>
          Save
        </Button>
      </div>
    </section>
  );
}
