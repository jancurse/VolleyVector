import { useState } from "react";
import type { JSX } from "react";
import { Plus, Trash2, X } from "lucide-react";

import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Toggle } from "../ui/Toggle";
import { cx, FIELD_LABEL, MUTED, PANEL, PANEL_TITLE, SLIP_ZONE_BUTTON } from "../ui/styles";
import { playerLabel } from "./format";
import {
  assignLibero,
  assignPosition,
  eligibleSubs,
  expectedRole,
  ROMAN,
  rotateBy,
  sortShifts,
  toggleAlternate,
  versionLabel,
} from "./rotation";
import { PlayerPicker } from "./PlayerPicker";
import { RotationSlip } from "./RotationSlip";
import type { Rotation, RosterPlayer } from "./types";

// A coach edits on the slip itself and turning it changes the saved positions; a viewer's turning only
// changes their view.
type RotationEditorProps = {
  rotation: Rotation;
  teamName: string;
  squad: readonly RosterPlayer[];
  players: ReadonlyMap<string, RosterPlayer>;
  readOnly: boolean;
  onChange: (rotation: Rotation) => void;
  onRemove: () => void;
};

export function RotationEditor({
  rotation,
  teamName,
  squad,
  players,
  readOnly,
  onChange,
  onRemove,
}: RotationEditorProps): JSX.Element {
  const [viewShift, setViewShift] = useState(0);
  const [adding, setAdding] = useState<string | null>(null);
  const label = (id: string) => playerLabel(players.get(id));
  const placedAt = (index: number) => (p: RosterPlayer) => {
    const at = rotation.positions.indexOf(p.id);

    return at >= 0 && at !== index ? `in ${ROMAN[at]}` : null;
  };

  const slip = readOnly ? (
    <RotationSlip
      teamName={teamName}
      rotation={rotation}
      players={players}
      shift={viewShift}
      onRotate={(steps) => setViewShift((s) => s + steps)}
    />
  ) : (
    <RotationSlip
      teamName={teamName}
      rotation={rotation}
      players={players}
      shift={0}
      onRotate={(steps) => onChange(rotateBy(rotation, steps))}
      zone={(index, content) => (
        <PlayerPicker
          trigger={
            <button
              type="button"
              className={SLIP_ZONE_BUTTON}
              aria-label={`Position ${ROMAN[index]}: ${rotation.positions[index] ? label(rotation.positions[index]) : "empty"}`}
            >
              {content}
            </button>
          }
          title={`Position ${ROMAN[index]}`}
          role={expectedRole(rotation, players, index)}
          players={squad.filter((p) => p.id !== rotation.libero)}
          selectedId={rotation.positions[index]}
          note={placedAt(index)}
          onPick={(id) => onChange(assignPosition(rotation, index, id))}
          onClear={rotation.positions[index] ? () => onChange(assignPosition(rotation, index, null)) : undefined}
        />
      )}
      libero={(content) => (
        <PlayerPicker
          trigger={
            <button
              type="button"
              className={SLIP_ZONE_BUTTON}
              aria-label={`Libero: ${rotation.libero ? label(rotation.libero) : "none"}`}
            >
              {content}
            </button>
          }
          title="Libero"
          role="libero"
          players={squad.filter((p) => !rotation.positions.includes(p.id))}
          selectedId={rotation.libero}
          onPick={(id) => onChange(assignLibero(rotation, id))}
          onClear={rotation.libero ? () => onChange(assignLibero(rotation, null)) : undefined}
        />
      )}
    />
  );

  const starters = rotation.positions.flatMap((id, index) => (id ? [{ id, index }] : []));
  const planned = starters.filter(({ id }) => rotation.alternates[id]?.length || id === adding);
  const unplanned = squad.filter(
    (p) => starters.some(({ id }) => id === p.id) && !planned.some(({ id }) => id === p.id)
  );
  const subs = (
    <div className="flex flex-col gap-2">
      <p className={cx(FIELD_LABEL, "m-0")}>Planned subs</p>
      {readOnly && planned.length === 0 && <p className={cx(MUTED, "text-sm")}>None planned.</p>}
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {planned.map(({ id, index }) => {
          const alts = rotation.alternates[id] ?? [];

          return (
            <li key={id} className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2 text-sm">
              <span className="w-6 font-mono text-2xs text-text-dim">{ROMAN[index]}</span>
              <span className="min-w-0">
                <span className="font-semibold">{label(id)}</span>
                {alts.length > 0 && <span className="text-text-dim"> ⇄ </span>}
                {alts.map((alt, i) => (
                  <span key={alt} className="inline-flex items-center">
                    {i > 0 && <span className="text-text-dim">,&nbsp;</span>}
                    {label(alt)}
                    {!readOnly && (
                      <IconButton
                        variant="plain"
                        size="xs"
                        tooltip={null}
                        aria-label={`Remove ${label(alt)} as sub for ${label(id)}`}
                        onClick={() => onChange(toggleAlternate(rotation, id, alt))}
                      >
                        <X size={11} aria-hidden="true" />
                      </IconButton>
                    )}
                  </span>
                ))}
                {!readOnly && eligibleSubs(rotation, id, squad).length > 0 && (
                  <PlayerPicker
                    trigger={
                      <Button variant="text" size="sm" className="ml-1 py-0" aria-label={`Add a sub for ${label(id)}`}>
                        <Plus size={12} aria-hidden="true" />
                        Sub
                      </Button>
                    }
                    title={`Sub for ${label(id)}`}
                    role={players.get(id)?.main ?? null}
                    players={eligibleSubs(rotation, id, squad)}
                    onPick={(alt) => {
                      onChange(toggleAlternate(rotation, id, alt));
                      setAdding(null);
                    }}
                  />
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {!readOnly && unplanned.length > 0 && (
        <PlayerPicker
          trigger={
            <Button variant="text" size="sm" className="self-start">
              <Plus size={12} aria-hidden="true" />
              Add planned sub
            </Button>
          }
          title="Who comes off?"
          role={null}
          players={unplanned}
          onPick={setAdding}
        />
      )}
    </div>
  );

  return (
    <section className={PANEL} aria-label={rotation.name}>
      <div className="flex items-center gap-2">
        {readOnly ? (
          <h2 className={PANEL_TITLE}>{rotation.name}</h2>
        ) : (
          <>
            <Input
              aria-label="Rotation name"
              className="max-w-xs font-ui font-semibold"
              value={rotation.name}
              onChange={(e) => onChange({ ...rotation, name: e.target.value })}
            />
            <span className="ml-auto flex items-center gap-2">
              <Toggle
                ariaLabel="5-1 suggestions"
                pressed={rotation.fiveOne}
                onPressedChange={(fiveOne) => onChange({ ...rotation, fiveOne })}
              >
                5-1 suggestions
              </Toggle>
              <IconButton variant="plain" size="sm" aria-label="Delete rotation" onClick={onRemove}>
                <Trash2 size={15} aria-hidden="true" />
              </IconButton>
            </span>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="w-slip max-w-full flex-none">{slip}</div>
        <div className="flex min-w-0 flex-1 basis-60 flex-col gap-4">
          {subs}
          {readOnly ? (
            rotation.notes.trim() && (
              <div className="flex flex-col gap-2">
                <p className={cx(FIELD_LABEL, "m-0")}>Notes</p>
                <p className="m-0 whitespace-pre-line text-sm">{rotation.notes}</p>
              </div>
            )
          ) : (
            <Field label="Notes">
              <Textarea
                compact
                value={rotation.notes}
                placeholder="Serve-receive plan, matchups, timeouts…"
                onChange={(e) => onChange({ ...rotation, notes: e.target.value })}
              />
            </Field>
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className={cx(FIELD_LABEL, "m-0")}>Print versions</p>
          <div className="flex flex-wrap gap-1.5">
            {sortShifts(rotation, players, [0, 1, 2, 3, 4, 5]).map((steps) => (
              <Toggle
                key={steps}
                ariaLabel={`Print ${versionLabel(rotation, players, steps)}`}
                pressed={rotation.printShifts.includes(steps)}
                onPressedChange={(on) =>
                  onChange({
                    ...rotation,
                    printShifts: on
                      ? [...rotation.printShifts, steps]
                      : rotation.printShifts.filter((s) => s !== steps),
                  })
                }
              >
                {versionLabel(rotation, players, steps)}
              </Toggle>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
