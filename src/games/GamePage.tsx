import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { Ellipsis, Plus, Printer } from "lucide-react";

import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { Input } from "../ui/Input";
import { Menu, MenuItem } from "../ui/Menu";
import { Toggle } from "../ui/Toggle";
import { EYEBROW, MUTED, PAGE, PAGE_BAR, PANEL_TITLE, TITLE } from "../ui/styles";
import { formatGameDate } from "./format";
import { createLineup, playerMap, setSquad } from "./lineup";
import { LineupEditor } from "./LineupEditor";
import type { Game, RosterPlayer } from "./types";

// One game: its name and optional date, the squad picked from the roster, and its lineups. A coach edits in
// place and every change saves itself shortly after the last edit (and on leaving the page); a viewer reads
// the lineups as their slips. Mount it keyed by the game id so a different game starts a fresh draft.
type GamePageProps = {
  game: Game;
  teamName: string;
  roster: readonly RosterPlayer[];
  canEdit: boolean;
  onSave: (game: Game) => Promise<{ error: string | null }>;
  onDelete: () => void;
  onPrint: () => void;
};

const SAVE_DELAY = 600;

export function GamePage({ game, teamName, roster, canEdit, onSave, onDelete, onPrint }: GamePageProps): JSX.Element {
  const [draft, setDraft] = useState(game);
  const [status, setStatus] = useState<string | null>(null);
  const pending = useRef<Game | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const save = useRef(onSave);

  useEffect(() => {
    save.current = onSave;
  }, [onSave]);

  const flush = () => {
    const next = pending.current;

    if (!next) return;

    pending.current = null;
    setStatus("Saving…");
    void save.current(next).then(({ error }) => setStatus(error ? `Couldn’t save: ${error}` : "Saved"));
  };

  // Leaving the page saves whatever is still waiting on the timer.
  useEffect(
    () => () => {
      clearTimeout(timer.current);

      if (pending.current) void save.current(pending.current);
    },
    []
  );

  const edit = (next: Game) => {
    setDraft(next);
    pending.current = next;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY);
  };

  const players = playerMap(roster);
  const squad = roster.filter((p) => draft.squad.includes(p.id));
  // The squad picker lists the active roster plus anyone archived who is still in this game's squad.
  const pickable = roster.filter((p) => !p.archived || draft.squad.includes(p.id));

  const addLineup = () =>
    edit({ ...draft, lineups: [...draft.lineups, createLineup(squad, `Lineup ${draft.lineups.length + 1}`)] });

  return (
    <section className={PAGE}>
      <div className={PAGE_BAR}>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className={EYEBROW}>Game</p>
          {canEdit ? (
            <Input
              variant="title"
              aria-label="Game name"
              placeholder="Untitled game"
              value={draft.name}
              onChange={(e) => edit({ ...draft, name: e.target.value })}
            />
          ) : (
            <h1 className={TITLE}>{draft.name || "Untitled game"}</h1>
          )}
          {!canEdit && draft.date && <p className="m-0 mt-1 text-sm text-text-dim">{formatGameDate(draft.date)}</p>}
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <span className="text-sm text-text-dim" role="status">
              {status}
            </span>
          )}
          {canEdit && (
            <Menu
              tooltip="More actions"
              trigger={
                <IconButton variant="control" aria-label="Game actions">
                  <Ellipsis size={16} aria-hidden="true" />
                </IconButton>
              }
            >
              <MenuItem onClick={onDelete}>
                <span className="text-danger">Delete game…</span>
              </MenuItem>
            </Menu>
          )}
          <Button
            variant="primary"
            onClick={() => {
              clearTimeout(timer.current);
              flush();
              onPrint();
            }}
          >
            <Printer size={15} aria-hidden="true" />
            Print slips
          </Button>
        </div>
      </div>

      {canEdit && (
        <Field label="Date" className="w-44">
          <Input
            type="date"
            value={draft.date ?? ""}
            onChange={(e) => edit({ ...draft, date: e.target.value || null })}
          />
        </Field>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="squad-title">
        <h2 id="squad-title" className={PANEL_TITLE}>
          Squad ({draft.squad.length})
        </h2>
        {pickable.length === 0 ? (
          <p className={MUTED}>The roster is empty. Add players on the team page.</p>
        ) : canEdit ? (
          <div className="flex flex-wrap gap-1.5">
            {pickable.map((p) => (
              <Toggle
                key={p.id}
                ariaLabel={`#${p.number} ${p.name}`}
                pressed={draft.squad.includes(p.id)}
                onPressedChange={(on) =>
                  edit(setSquad(draft, on ? [...draft.squad, p.id] : draft.squad.filter((id) => id !== p.id)))
                }
              >
                <span className="font-display font-bold tabular-nums">{p.number}</span>
                {p.name}
              </Toggle>
            ))}
          </div>
        ) : (
          <p className="m-0 text-sm">{squad.map((p) => `#${p.number} ${p.name}`).join(", ") || "No one picked yet."}</p>
        )}
      </section>

      {draft.lineups.map((lineup) => (
        <LineupEditor
          key={lineup.id}
          lineup={lineup}
          teamName={teamName}
          squad={squad}
          players={players}
          readOnly={!canEdit}
          onChange={(next) => edit({ ...draft, lineups: draft.lineups.map((l) => (l.id === next.id ? next : l)) })}
          onRemove={() => edit({ ...draft, lineups: draft.lineups.filter((l) => l.id !== lineup.id) })}
        />
      ))}

      {draft.lineups.length === 0 && !canEdit && <p className={MUTED}>No lineups yet.</p>}

      {canEdit && (
        <Button variant="dashed" className="self-start" onClick={addLineup}>
          <Plus size={15} aria-hidden="true" />
          Add lineup
        </Button>
      )}
    </section>
  );
}
