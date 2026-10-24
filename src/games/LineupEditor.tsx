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
  shiftPositions,
  sortShifts,
  toggleAlternate,
  versionLabel,
} from "./lineup";
import { PlayerPicker } from "./PlayerPicker";
import { RotationSlip } from "./RotationSlip";
import type { Lineup, RosterPlayer } from "./types";

// One lineup of a game, shown as its rotation slip beside its possible subs and notes. A coach edits on the
// slip itself: each zone and the libero cell open a player picker, and the rotate controls beside the stamp
// turn the whole lineup a position either way. Below sit the 5-1 suggestions switch and the rotated versions
// to print. A viewer gets the same slip read-only and may rotate it to read the other rotations.
type LineupEditorProps = {
  lineup: Lineup;
  teamName: string;
  squad: readonly RosterPlayer[];
  players: ReadonlyMap<string, RosterPlayer>;
  readOnly: boolean;
  onChange: (lineup: Lineup) => void;
  onRemove: () => void;
};

export function LineupEditor({
  lineup,
  teamName,
  squad,
  players,
  readOnly,
  onChange,
  onRemove,
}: LineupEditorProps): JSX.Element {
  const [viewShift, setViewShift] = useState(0);
  const label = (id: string) => playerLabel(players.get(id));
  const placedAt = (index: number) => (p: RosterPlayer) => {
    const at = lineup.positions.indexOf(p.id);

    return at >= 0 && at !== index ? `in ${ROMAN[at]}` : null;
  };

  const slip = readOnly ? (
    <RotationSlip
      teamName={teamName}
      lineup={lineup}
      players={players}
      shift={viewShift}
      onRotate={(steps) => setViewShift((s) => s + steps)}
    />
  ) : (
    <RotationSlip
      teamName={teamName}
      lineup={lineup}
      players={players}
      shift={0}
      onRotate={(steps) => onChange({ ...lineup, positions: shiftPositions(lineup.positions, steps) })}
      zone={(index, content) => (
        <PlayerPicker
          trigger={
            <button
              type="button"
              className={SLIP_ZONE_BUTTON}
              aria-label={`Position ${ROMAN[index]}: ${lineup.positions[index] ? label(lineup.positions[index]) : "empty"}`}
            >
              {content}
            </button>
          }
          title={`Position ${ROMAN[index]}`}
          role={expectedRole(lineup, players, index)}
          players={squad.filter((p) => p.id !== lineup.libero)}
          selectedId={lineup.positions[index]}
          note={placedAt(index)}
          onPick={(id) => onChange(assignPosition(lineup, index, id))}
          onClear={lineup.positions[index] ? () => onChange(assignPosition(lineup, index, null)) : undefined}
        />
      )}
      libero={(content) => (
        <PlayerPicker
          trigger={
            <button
              type="button"
              className={SLIP_ZONE_BUTTON}
              aria-label={`Libero: ${lineup.libero ? label(lineup.libero) : "none"}`}
            >
              {content}
            </button>
          }
          title="Libero"
          role="libero"
          players={squad.filter((p) => !lineup.positions.includes(p.id))}
          selectedId={lineup.libero}
          onPick={(id) => onChange(assignLibero(lineup, id))}
          onClear={lineup.libero ? () => onChange(assignLibero(lineup, null)) : undefined}
        />
      )}
    />
  );

  const starters = lineup.positions.flatMap((id, index) => (id ? [{ id, index }] : []));
  const subs = (
    <div className="flex flex-col gap-2">
      <p className={cx(FIELD_LABEL, "m-0")}>Possible subs</p>
      {starters.length === 0 && <p className={cx(MUTED, "text-sm")}>Place starters to list their subs.</p>}
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {starters.map(({ id, index }) => {
          const alts = lineup.alternates[id] ?? [];

          if (readOnly && alts.length === 0) return null;

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
                        onClick={() => onChange(toggleAlternate(lineup, id, alt))}
                      >
                        <X size={11} aria-hidden="true" />
                      </IconButton>
                    )}
                  </span>
                ))}
                {!readOnly && eligibleSubs(lineup, id, squad).length > 0 && (
                  <PlayerPicker
                    trigger={
                      <Button variant="text" size="sm" className="ml-1 py-0" aria-label={`Add a sub for ${label(id)}`}>
                        <Plus size={12} aria-hidden="true" />
                        Sub
                      </Button>
                    }
                    title={`Sub for ${label(id)}`}
                    role={players.get(id)?.main ?? null}
                    players={eligibleSubs(lineup, id, squad)}
                    onPick={(alt) => onChange(toggleAlternate(lineup, id, alt))}
                  />
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <section className={PANEL} aria-label={lineup.name}>
      <div className="flex items-center gap-2">
        {readOnly ? (
          <h2 className={PANEL_TITLE}>{lineup.name}</h2>
        ) : (
          <>
            <Input
              aria-label="Lineup name"
              className="max-w-xs font-ui font-semibold"
              value={lineup.name}
              onChange={(e) => onChange({ ...lineup, name: e.target.value })}
            />
            <span className="ml-auto flex items-center gap-2">
              <Toggle
                ariaLabel="5-1 suggestions"
                pressed={lineup.fiveOne}
                onPressedChange={(fiveOne) => onChange({ ...lineup, fiveOne })}
              >
                5-1 suggestions
              </Toggle>
              <IconButton variant="plain" size="sm" aria-label="Delete lineup" onClick={onRemove}>
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
            lineup.notes.trim() && (
              <div className="flex flex-col gap-2">
                <p className={cx(FIELD_LABEL, "m-0")}>Notes</p>
                <p className="m-0 whitespace-pre-line text-sm">{lineup.notes}</p>
              </div>
            )
          ) : (
            <Field label="Notes">
              <Textarea
                compact
                value={lineup.notes}
                placeholder="Serve-receive plan, matchups, timeouts…"
                onChange={(e) => onChange({ ...lineup, notes: e.target.value })}
              />
            </Field>
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className={cx(FIELD_LABEL, "m-0")}>Print versions</p>
          <div className="flex flex-wrap gap-1.5">
            {sortShifts(lineup, players, [0, 1, 2, 3, 4, 5]).map((steps) => (
              <Toggle
                key={steps}
                ariaLabel={`Print ${versionLabel(lineup, players, steps)}`}
                pressed={lineup.printShifts.includes(steps)}
                onPressedChange={(on) =>
                  onChange({
                    ...lineup,
                    printShifts: on ? [...lineup.printShifts, steps] : lineup.printShifts.filter((s) => s !== steps),
                  })
                }
              >
                {versionLabel(lineup, players, steps)}
              </Toggle>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
