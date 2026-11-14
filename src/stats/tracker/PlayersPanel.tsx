import { useState } from "react";
import type { JSX } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

import { Button } from "../../ui/Button";
import { Collapsible, CollapsibleCaret, CollapsiblePanel } from "../../ui/Collapsible";
import { IconButton } from "../../ui/IconButton";
import { Input } from "../../ui/Input";
import { PANEL, PANEL_TITLE } from "../../ui/styles";
import { playerKey } from "./courtRows";

type PlayersPanelProps = {
  players: readonly string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onMove: (name: string, delta: number) => void;
};

/** The set's players: they start as the game's squad; order sets each one's number key. */
export function PlayersPanel({ players, onAdd, onRemove, onMove }: PlayersPanelProps): JSX.Element {
  const [name, setName] = useState("");

  const add = () => {
    // A whole list can be pasted at once: "Mira, Nell, Sian".
    name
      .split(/[,\n]/)
      .map((n) => n.trim())
      .filter(Boolean)
      .forEach(onAdd);
    setName("");
  };

  return (
    <Collapsible defaultOpen={players.length === 0} className={PANEL}>
      <div className="flex items-center gap-1">
        <CollapsibleCaret label="Players" />
        <h2 className={PANEL_TITLE}>Players ({players.length})</h2>
      </div>
      <CollapsiblePanel className="flex flex-col gap-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input
            aria-label="Player name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Player name (or a comma-separated list)"
            className="flex-1"
          />
          <Button type="submit" variant="ghost" paired disabled={!name.trim()}>
            Add
          </Button>
        </form>
        {players.length > 0 && (
          <>
            <p className="m-0 text-xs text-text-dim">Order sets the keyboard shortcut (1–9, 0).</p>
            <ul className="m-0 grid list-none grid-cols-2 gap-1.5 p-0">
              {players.map((p, i) => (
                <li key={p} className="flex items-center gap-1 rounded-md bg-control py-1 pr-1 pl-2">
                  <span className="w-3 font-mono text-xs text-text-dim">{playerKey(i) ?? ""}</span>
                  <span className="flex-1 truncate text-sm">{p}</span>
                  <IconButton
                    variant="plain"
                    size="xs"
                    aria-label={`Move ${p} up`}
                    disabled={i === 0}
                    onClick={() => onMove(p, -1)}
                  >
                    <ChevronLeft size={14} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    variant="plain"
                    size="xs"
                    aria-label={`Move ${p} down`}
                    disabled={i === players.length - 1}
                    onClick={() => onMove(p, 1)}
                  >
                    <ChevronRight size={14} aria-hidden="true" />
                  </IconButton>
                  <IconButton variant="plain" size="xs" aria-label={`Remove ${p}`} onClick={() => onRemove(p)}>
                    <Trash2 size={14} aria-hidden="true" />
                  </IconButton>
                </li>
              ))}
            </ul>
          </>
        )}
      </CollapsiblePanel>
    </Collapsible>
  );
}
