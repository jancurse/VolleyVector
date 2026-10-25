import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { Ellipsis, Plus, Printer, Users } from "lucide-react";

import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { Input } from "../ui/Input";
import { Menu, MenuItem } from "../ui/Menu";
import { Table, TableCell, TableHeadCell } from "../ui/Table";
import { cx, EYEBROW, MUTED, PAGE, PAGE_BAR, PANEL, PANEL_TITLE, TITLE } from "../ui/styles";
import { formatGameDate } from "./format";
import { createRotation, playerMap, sortSquad } from "./rotation";
import { RotationEditor } from "./RotationEditor";
import { OverviewSlip } from "./OverviewSlip";
import { PositionChip } from "./PositionChip";
import { SquadDialog } from "./SquadDialog";
import type { Game, RosterPlayer } from "./types";

// A coach's edits save themselves shortly after the last change and on leaving the page. Mount it keyed by
// the game id so a different game starts a fresh draft.
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
  const [picking, setPicking] = useState(false);
  const [viewShift, setViewShift] = useState(game.overviewShift);
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

  const players = playerMap(roster, draft.overrides);
  // A coach rotates the saved overview; a viewer rotates only their own view of it.
  const overviewShift = canEdit ? draft.overviewShift : viewShift;
  const squad = roster.filter((p) => draft.squad.includes(p.id)).map((p) => players.get(p.id) ?? p);
  // The squad picker lists the active roster plus anyone archived who is still in this game's squad.
  const pickable = roster.filter((p) => !p.archived || draft.squad.includes(p.id));

  const addRotation = () =>
    edit({
      ...draft,
      rotations: [...draft.rotations, createRotation(squad, `Rotation ${draft.rotations.length + 1}`)],
    });

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

      <div className="flex flex-wrap items-start gap-[clamp(1rem,3vh,1.6rem)]">
        <section className={cx(PANEL, "max-w-full")} aria-labelledby="squad-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="squad-title" className={PANEL_TITLE}>
              Squad ({squad.length})
            </h2>
            {canEdit && pickable.length > 0 && (
              <Button variant="ghost" onClick={() => setPicking(true)}>
                <Users size={15} aria-hidden="true" />
                Pick squad
              </Button>
            )}
          </div>
          {pickable.length === 0 ? (
            <p className={MUTED}>The roster is empty. Add players on the team page.</p>
          ) : squad.length === 0 ? (
            <p className={MUTED}>No one picked yet.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <TableHeadCell className="w-16">No.</TableHeadCell>
                  <TableHeadCell>Player</TableHeadCell>
                  <TableHeadCell>Position</TableHeadCell>
                  <TableHeadCell>Also plays</TableHeadCell>
                </tr>
              </thead>
              <tbody>
                {sortSquad(squad).map((p) => (
                  <tr key={p.id}>
                    <TableCell className="font-display text-xl font-bold tabular-nums">{p.number}</TableCell>
                    <TableCell className="max-w-xs truncate font-medium">
                      {p.name}
                      {draft.overrides[p.id] && <span className="ml-2 text-xs text-text-dim">this game</span>}
                    </TableCell>
                    <TableCell>
                      <PositionChip position={p.main} />
                    </TableCell>
                    <TableCell>
                      {p.secondary.map((s) => (
                        <PositionChip key={s} position={s} secondary />
                      ))}
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>

        {squad.length > 0 && (
          <section className={PANEL} aria-labelledby="overview-title">
            <h2 id="overview-title" className={PANEL_TITLE}>
              Overview
            </h2>
            <div className="w-overview max-w-full">
              <OverviewSlip
                teamName={teamName}
                squad={squad}
                shift={overviewShift}
                onRotate={(steps) => {
                  const shift = (((overviewShift + steps) % 6) + 6) % 6;

                  if (canEdit) edit({ ...draft, overviewShift: shift });
                  else setViewShift(shift);
                }}
              />
            </div>
          </section>
        )}
      </div>

      <div className="flex max-w-4xl flex-col gap-[clamp(1rem,3vh,1.6rem)]">
        {draft.rotations.map((rotation) => (
          <RotationEditor
            key={rotation.id}
            rotation={rotation}
            teamName={teamName}
            squad={squad}
            players={players}
            readOnly={!canEdit}
            onChange={(next) =>
              edit({ ...draft, rotations: draft.rotations.map((l) => (l.id === next.id ? next : l)) })
            }
            onRemove={() => edit({ ...draft, rotations: draft.rotations.filter((l) => l.id !== rotation.id) })}
          />
        ))}

        {draft.rotations.length === 0 && !canEdit && <p className={MUTED}>No rotations yet.</p>}

        {canEdit && (
          <Button variant="dashed" className="self-start" onClick={addRotation}>
            <Plus size={15} aria-hidden="true" />
            Add rotation
          </Button>
        )}
      </div>

      {picking && <SquadDialog game={draft} roster={pickable} onChange={edit} onClose={() => setPicking(false)} />}
    </section>
  );
}
