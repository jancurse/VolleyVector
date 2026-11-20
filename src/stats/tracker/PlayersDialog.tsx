import type { JSX } from "react";

import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import type { Court, Team } from "../types";
import { LineupPanel } from "./LineupPanel";
import { PlayersPanel } from "./PlayersPanel";

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
};

/** Who plays the set: the starting lineup, substitutions, and the player list with its number keys. */
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
      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      </div>
    </Dialog>
  );
}
