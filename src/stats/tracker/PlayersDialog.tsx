import type { JSX } from "react";

import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import type { Court, MatchMeta, Team } from "../types";
import { LineupPanel } from "./LineupPanel";
import { PlayersPanel } from "./PlayersPanel";
import { SetupPanel } from "./SetupPanel";

type PlayersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  court: Court | null;
  serving: Team | null;
  players: readonly string[];
  lineup: readonly string[];
  libero: string;
  onSetLineup: (lineup: string[], libero: string) => void;
  onSub: (out: string, inn: string) => void;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onMove: (name: string, to: number) => void;
  meta: MatchMeta;
  names: { us: string; them: string };
  hasEvents: boolean;
  onMeta: (meta: Partial<MatchMeta>) => void;
};

/** How the set is set up: the starting lineup, substitutions, the player list with its number keys, and its start. */
export function PlayersDialog({
  open,
  onOpenChange,
  court,
  serving,
  players,
  lineup,
  libero,
  onSetLineup,
  onSub,
  onAdd,
  onRemove,
  onMove,
  meta,
  names,
  hasEvents,
  onMeta,
}: PlayersDialogProps): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Lineup and players">
      <LineupPanel
        court={court}
        serving={serving}
        players={players}
        lineup={lineup}
        libero={libero}
        onSetLineup={onSetLineup}
        onSub={onSub}
      />
      <PlayersPanel players={players} onAdd={onAdd} onRemove={onRemove} onMove={onMove} />
      <SetupPanel meta={meta} names={names} hasEvents={hasEvents} onMeta={onMeta} />
      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      </div>
    </Dialog>
  );
}
