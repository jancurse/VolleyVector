import { useState } from "react";
import type { JSX } from "react";
import { Pencil } from "lucide-react";

import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { cx, MUTED } from "../ui/styles";
import { POSITION_OPTIONS } from "./format";
import { setOverride, setSquad } from "./lineup";
import { PositionChip } from "./PositionChip";
import type { Game, Position, RosterPlayer } from "./types";

// Pick the game's squad from the roster, filtered by number or name. A picked player can also be adjusted
// for this game only (a different number or positions), which leaves the roster untouched. Every change
// applies to the game as it is made; Done just closes.
type SquadDialogProps = {
  game: Game;
  /** The pickable roster as stored, with no game overrides applied. */
  roster: readonly RosterPlayer[];
  onChange: (game: Game) => void;
  onClose: () => void;
};

export function SquadDialog({ game, roster, onChange, onClose }: SquadDialogProps): JSX.Element {
  const [filter, setFilter] = useState("");
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const query = filter.trim().toLowerCase();
  const shown = roster.filter((p) => !query || `${p.number} ${p.name}`.toLowerCase().includes(query));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={`Squad (${game.squad.length})`}>
      <Input
        aria-label="Filter players"
        placeholder="Filter by number or name"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {shown.length === 0 && <p className={cx(MUTED, "text-sm")}>No player matches.</p>}
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {shown.map((rosterPlayer) => {
          const picked = game.squad.includes(rosterPlayer.id);
          const override = game.overrides[rosterPlayer.id] ?? {};
          const p = { ...rosterPlayer, ...override };
          const adjust = (patch: Partial<Pick<RosterPlayer, "number" | "main" | "secondary">>) =>
            onChange(setOverride(game, rosterPlayer, { ...override, ...patch }));

          return (
            <li key={p.id} className="flex flex-col gap-2 rounded-md px-1 py-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  ariaLabel={`#${p.number} ${p.name}`}
                  checked={picked}
                  onCheckedChange={(on) =>
                    onChange(setSquad(game, on ? [...game.squad, p.id] : game.squad.filter((id) => id !== p.id)))
                  }
                >
                  <span className="flex items-baseline gap-2">
                    <span className="w-6 text-right font-display font-bold tabular-nums">{p.number}</span>
                    <span>{p.name}</span>
                    {Object.keys(override).length > 0 && <span className="text-xs text-text-dim">this game</span>}
                  </span>
                </Checkbox>
                <span className="ml-auto flex items-center gap-1">
                  <PositionChip position={p.main} />
                  {p.secondary && <PositionChip position={p.secondary} secondary />}
                  {picked && (
                    <IconButton
                      variant="plain"
                      size="sm"
                      aria-label={`Adjust #${p.number} for this game`}
                      aria-expanded={adjusting === p.id}
                      onClick={() => setAdjusting(adjusting === p.id ? null : p.id)}
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </IconButton>
                  )}
                </span>
              </div>
              {picked && adjusting === p.id && (
                <div className="ml-7 flex flex-wrap items-end gap-3 rounded-md border border-border p-3">
                  <Field label="Number" className="w-20">
                    <Input
                      inputMode="numeric"
                      defaultValue={String(p.number)}
                      onChange={(e) => {
                        const n = Number(e.target.value);

                        if (e.target.value.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= 99)
                          adjust({ number: n });
                      }}
                    />
                  </Field>
                  <Field label="Main position" className="w-44">
                    <Select
                      ariaLabel="Main position"
                      value={p.main}
                      options={POSITION_OPTIONS}
                      onValueChange={(v) =>
                        adjust({ main: v as Position, secondary: p.secondary === v ? null : p.secondary })
                      }
                    />
                  </Field>
                  <Field label="Secondary position" className="w-44">
                    <Select
                      ariaLabel="Secondary position"
                      value={p.secondary ?? ""}
                      options={[{ value: "", label: "None" }, ...POSITION_OPTIONS.filter((o) => o.value !== p.main)]}
                      onValueChange={(v) => adjust({ secondary: v === "" ? null : (v as Position) })}
                    />
                  </Field>
                  {Object.keys(override).length > 0 && (
                    <Button
                      variant="text"
                      size="sm"
                      onClick={() => {
                        onChange(setOverride(game, rosterPlayer, {}));
                        setAdjusting(null);
                      }}
                    >
                      Use roster values
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
    </Dialog>
  );
}
