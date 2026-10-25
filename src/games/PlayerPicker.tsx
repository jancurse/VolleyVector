import { useState } from "react";
import type { JSX, ReactElement } from "react";
import { Check } from "lucide-react";

import { ROLES } from "../court/roles";
import { Button } from "../ui/Button";
import { Popover } from "../ui/Popover";
import { cx, FIELD_LABEL, MUTED, PICK_ROW } from "../ui/styles";
import { rankForRole } from "./rotation";
import { PositionChip } from "./PositionChip";
import type { Position, RosterPlayer } from "./types";

// With a suggested `role`, players who fit lead and everyone else waits behind a "show everyone" switch.
// `note` marks a player already placed (e.g. "in IV"), so picking them reads as a swap.
type PlayerPickerProps = {
  trigger: ReactElement;
  title: string;
  role: Position | null;
  players: readonly RosterPlayer[];
  selectedId?: string | null;
  note?: (player: RosterPlayer) => string | null;
  onPick: (id: string) => void;
  /** Empty the cell; offered only while it holds someone. */
  onClear?: () => void;
};

export function PlayerPicker({
  trigger,
  title,
  role,
  players,
  selectedId = null,
  note = () => null,
  onPick,
  onClear,
}: PlayerPickerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const { fits, canPlay, others } = rankForRole(players, role);

  const choose = (act: () => void) => {
    act();
    setOpen(false);
  };

  const rows = (list: readonly RosterPlayer[]) =>
    list.map((p) => {
      const placed = note(p);

      return (
        <li key={p.id}>
          <button
            type="button"
            className={PICK_ROW}
            aria-pressed={p.id === selectedId}
            onClick={() => choose(() => onPick(p.id))}
          >
            <span className="w-6 flex-none text-right font-display text-lg font-extrabold tabular-nums">
              {p.number}
            </span>
            <span className={cx("min-w-0 flex-1 truncate", placed && "text-text-dim")}>{p.name}</span>
            {placed && <span className="flex-none font-mono text-2xs text-text-dim">{placed}</span>}
            <span className="flex flex-none gap-1">
              <PositionChip position={p.main} />
              {p.secondary.map((s) => (
                <PositionChip key={s} position={s} secondary />
              ))}
            </span>
            <Check
              size={14}
              aria-hidden="true"
              className={cx("flex-none text-accent", p.id !== selectedId && "invisible")}
            />
          </button>
        </li>
      );
    });

  const group = (heading: string | null, list: readonly RosterPlayer[]) =>
    list.length > 0 && (
      <div className="flex flex-col gap-1">
        {heading && <p className={cx(FIELD_LABEL, "m-0 px-2")}>{heading}</p>}
        <ul className="m-0 flex list-none flex-col p-0">{rows(list)}</ul>
      </div>
    );

  return (
    <Popover
      trigger={trigger}
      ariaLabel={title}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setShowAll(false);
      }}
    >
      <div className="flex w-80 flex-col gap-3">
        <p className="m-0 px-2 font-semibold">{title}</p>
        {players.length === 0 && <p className={cx(MUTED, "px-2 text-sm")}>No one left to pick.</p>}
        {group(role && ROLES[role].name, fits)}
        {group(role && `Also plays ${ROLES[role].name.toLowerCase()}`, canPlay)}
        {others.length > 0 &&
          (showAll ? (
            group("Everyone else", others)
          ) : (
            <Button variant="text" size="sm" className="self-start" onClick={() => setShowAll(true)}>
              Show everyone else ({others.length})
            </Button>
          ))}
        {onClear && (
          <Button variant="text" size="sm" className="self-start" onClick={() => choose(onClear)}>
            Leave empty
          </Button>
        )}
      </div>
    </Popover>
  );
}
