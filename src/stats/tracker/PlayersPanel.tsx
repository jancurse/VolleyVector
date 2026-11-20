import { useState } from "react";
import type { JSX } from "react";
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from "lucide-react";

import { Button } from "../../ui/Button";
import { IconButton } from "../../ui/IconButton";
import { Input } from "../../ui/Input";
import { cx, PANEL_TITLE, PLAYER_ROW, PLAYER_ROW_TARGET, SUBPANEL } from "../../ui/styles";
import { playerKey } from "./courtRows";

type PlayersPanelProps = {
  players: readonly string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  /** Move a player to position `to` in the list. */
  onMove: (name: string, to: number) => void;
};

/** The set's players: they start as the game's squad; order sets each one's number key. */
export function PlayersPanel({ players, onAdd, onRemove, onMove }: PlayersPanelProps): JSX.Element {
  const [name, setName] = useState("");
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const add = () => {
    // A whole list can be pasted at once: "Mira, Nell, Sian".
    name
      .split(/[,\n]/)
      .map((n) => n.trim())
      .filter(Boolean)
      .forEach(onAdd);
    setName("");
  };

  const endDrag = () => {
    setDragged(null);
    setOver(null);
  };

  return (
    <section className={SUBPANEL} aria-labelledby="players-title">
      <h2 id="players-title" className={PANEL_TITLE}>
        Players ({players.length})
      </h2>
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
          <p className="m-0 text-xs text-text-dim">
            Order sets the keyboard shortcut (1–9, 0). Drag a player to move them.
          </p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {players.map((p, i) => (
              <li
                key={p}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  // Firefox starts a drag only once it carries data.
                  e.dataTransfer.setData("text/plain", p);
                  setDragged(p);
                }}
                onDragOver={(e) => {
                  if (!dragged) return;

                  e.preventDefault();
                  setOver(p);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragged) onMove(dragged, i);
                  endDrag();
                }}
                onDragEnd={endDrag}
                className={cx(PLAYER_ROW, dragged && over === p && dragged !== p && PLAYER_ROW_TARGET)}
              >
                <GripVertical size={14} aria-hidden="true" className="flex-none text-text-dim" />
                <span className="w-3 font-mono text-xs text-text-dim">{playerKey(i) ?? ""}</span>
                <span className="flex-1 truncate text-sm">{p}</span>
                <IconButton
                  variant="plain"
                  size="xs"
                  aria-label={`Move ${p} up`}
                  disabled={i === 0}
                  onClick={() => onMove(p, i - 1)}
                >
                  <ChevronUp size={14} aria-hidden="true" />
                </IconButton>
                <IconButton
                  variant="plain"
                  size="xs"
                  aria-label={`Move ${p} down`}
                  disabled={i === players.length - 1}
                  onClick={() => onMove(p, i + 1)}
                >
                  <ChevronDown size={14} aria-hidden="true" />
                </IconButton>
                <IconButton variant="plain" size="xs" aria-label={`Remove ${p}`} onClick={() => onRemove(p)}>
                  <Trash2 size={14} aria-hidden="true" />
                </IconButton>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
