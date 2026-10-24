import type { JSX } from "react";
import { RotateCcw, RotateCw, Trash2, X } from "lucide-react";

import { Field } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { Toggle } from "../ui/Toggle";
import { cx, FIELD_LABEL, MUTED, PANEL, PANEL_TITLE, TAG_CHIP } from "../ui/styles";
import { playerLabel } from "./format";
import {
  assignPosition,
  COURT_ORDER,
  ROMAN,
  shiftPositions,
  sortShifts,
  toggleAlternate,
  versionLabel,
} from "./lineup";
import { RotationSlip } from "./RotationSlip";
import type { Lineup, RosterPlayer } from "./types";

// One lineup of a game. A coach places the squad on the six official positions (the zones read like the
// slip: front row IV-III-II under the net), rotates the whole lineup a position either way, picks the
// libero, plans alternatives per starter, writes notes, and chooses which rotated versions print. A
// viewer sees the lineup as its slip, with its subs and notes.
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
  const options = squad.map((p) => ({ value: p.id, label: playerLabel(p) }));
  const starters = lineup.positions.filter((id): id is string => id !== null);
  const label = (id: string) => playerLabel(players.get(id));

  const subs = (
    <div className="flex flex-col gap-2">
      <p className={FIELD_LABEL}>Planned subs</p>
      {starters.length === 0 && <p className={MUTED}>Place starters to plan subs for them.</p>}
      {lineup.positions.map((id, index) => {
        if (id === null) return null;

        const alts = lineup.alternates[id] ?? [];

        if (readOnly && alts.length === 0) return null;

        const free = options.filter((o) => o.value !== id && o.value !== lineup.libero && !alts.includes(o.value));

        return (
          <div key={id} className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="w-8 font-mono text-2xs text-text-dim">{ROMAN[index]}</span>
            <span className="font-semibold">{label(id)}</span>
            <span className="text-text-dim" aria-hidden="true">
              ⇄
            </span>
            {alts.map((alt) => (
              <span key={alt} className={TAG_CHIP}>
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
            {!readOnly && free.length > 0 && (
              <Select
                variant="quiet"
                ariaLabel={`Add a sub for ${label(id)}`}
                value=""
                options={[{ value: "", label: "Add sub" }, ...free]}
                onValueChange={(alt) => alt && onChange(toggleAlternate(lineup, id, alt))}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  if (readOnly) {
    return (
      <section className={PANEL} aria-label={lineup.name}>
        <h2 className={PANEL_TITLE}>{lineup.name}</h2>
        <div className="grid grid-cols-[minmax(0,20rem)_minmax(0,1fr)] gap-6 max-[760px]:grid-cols-1">
          <RotationSlip teamName={teamName} lineup={lineup} players={players} shift={0} />
          <div className="flex flex-col gap-4">
            {subs}
            {lineup.notes.trim() && (
              <div className="flex flex-col gap-2">
                <p className={FIELD_LABEL}>Notes</p>
                <p className="m-0 whitespace-pre-line text-sm">{lineup.notes}</p>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  const shift = (steps: number) => onChange({ ...lineup, positions: shiftPositions(lineup.positions, steps) });

  return (
    <section className={PANEL} aria-label={lineup.name}>
      <div className="flex items-center gap-2">
        <Input
          aria-label="Lineup name"
          className="max-w-xs font-ui font-semibold"
          value={lineup.name}
          onChange={(e) => onChange({ ...lineup, name: e.target.value })}
        />
        <span className="ml-auto flex gap-1">
          <IconButton size="sm" aria-label="Rotate back (I → II)" onClick={() => shift(1)}>
            <RotateCcw size={15} aria-hidden="true" />
          </IconButton>
          <IconButton size="sm" aria-label="Rotate forward (II → I)" onClick={() => shift(-1)}>
            <RotateCw size={15} aria-hidden="true" />
          </IconButton>
          <IconButton variant="plain" size="sm" aria-label="Delete lineup" onClick={onRemove}>
            <Trash2 size={15} aria-hidden="true" />
          </IconButton>
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,4fr)_minmax(0,3fr)] gap-6 max-[900px]:grid-cols-1">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col">
            <div className="flex items-center justify-between pb-1">
              <span className={FIELD_LABEL}>Net</span>
              <span className="font-mono text-2xs font-bold text-accent uppercase">
                {versionLabel(lineup, players, 0)}
              </span>
            </div>
            <div className="border-t-4 border-double border-text" aria-hidden="true" />
            <div className="grid grid-cols-3 border-x border-b border-border">
              {COURT_ORDER.map((index, i) => (
                <div
                  key={index}
                  className={cx(
                    "flex flex-col gap-1 p-1.5",
                    i < 3 && "bg-[var(--court-zone)]/40",
                    i % 3 !== 2 && "border-r border-border",
                    i >= 3 && "border-t border-dashed border-t-text/40"
                  )}
                >
                  <span className="font-mono text-2xs text-text-dim">{ROMAN[index]}</span>
                  <Select
                    ariaLabel={`Position ${ROMAN[index]}`}
                    value={lineup.positions[index] ?? ""}
                    options={[{ value: "", label: "Empty" }, ...options]}
                    onValueChange={(id) => onChange(assignPosition(lineup, index, id || null))}
                  />
                </div>
              ))}
            </div>
          </div>
          <Field label="Libero" className="w-60">
            <Select
              ariaLabel="Libero"
              value={lineup.libero ?? ""}
              options={[{ value: "", label: "None" }, ...options.filter((o) => !starters.includes(o.value))]}
              onValueChange={(id) => onChange({ ...lineup, libero: id || null })}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-4">
          {subs}
          <Field label="Notes">
            <Textarea
              compact
              value={lineup.notes}
              placeholder="Serve-receive plan, matchups, timeouts…"
              onChange={(e) => onChange({ ...lineup, notes: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <p className={FIELD_LABEL}>Print versions</p>
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
    </section>
  );
}
