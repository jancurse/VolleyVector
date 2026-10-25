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
import { ToggleGroup } from "../ui/ToggleGroup";
import { cx, MUTED } from "../ui/styles";
import { playerLabel, POSITION_OPTIONS } from "./format";
import { playerMap, secondaryOf, setOverride, setSquad } from "./rotation";
import { PositionChip } from "./PositionChip";
import type { Game, PlayerOverride, Position, RosterPlayer } from "./types";

// Changes apply to the game as they are made, so Done only closes. A clashing number is flagged, not blocked.
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
  const players = playerMap(roster, game.overrides);

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
          const override = game.overrides[rosterPlayer.id];
          const p = { ...rosterPlayer, ...override };
          const clash = game.squad
            .map((id) => players.get(id))
            .find((o) => o && o.id !== p.id && o.number === p.number);
          const adjust = (patch: PlayerOverride) =>
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
                    {override && <span className="text-xs text-text-dim">this game</span>}
                  </span>
                </Checkbox>
                <span className="ml-auto flex items-center gap-1">
                  <PositionChip position={p.main} />
                  {p.secondary.map((s) => (
                    <PositionChip key={s} position={s} secondary />
                  ))}
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
                        adjust({ main: v as Position, secondary: secondaryOf(p.secondary, v as Position) })
                      }
                    />
                  </Field>
                  <Field label="Also plays">
                    <ToggleGroup
                      multiple
                      variant="pills"
                      ariaLabel="Also plays"
                      items={POSITION_OPTIONS.filter((o) => o.value !== p.main)}
                      value={p.secondary}
                      onValueChange={(v) => adjust({ secondary: secondaryOf(v, p.main) })}
                    />
                  </Field>
                  {override && (
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
                  {clash && <p className="m-0 w-full text-sm text-danger">Also worn by {playerLabel(clash)}</p>}
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
