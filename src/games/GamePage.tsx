import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { Ellipsis, Plus, Printer, Users } from "lucide-react";

import { playersWithStats, rosterSpellingsOf, setPlayerNames, withGameMeta } from "../stats/gameSets";
import { choiceRenames, newPlayers, unmatchedNames } from "../stats/matchPlayers";
import type { PlayerChoice } from "../stats/matchPlayers";
import type { SetSummary } from "../stats/types";
import type { Backup } from "../stats/sync/setSync";
import { useGameSetData } from "../stats/useGameSetData";
import type { GameSetData } from "../stats/useGameSetData";
import type { PlayerDraft } from "./useRoster";

import { Button } from "../ui/Button";
import { Collapsible, CollapsibleCaret, CollapsiblePanel } from "../ui/Collapsible";
import { Field } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { Input } from "../ui/Input";
import { Menu, MenuItem } from "../ui/Menu";
import { Select } from "../ui/Select";
import { Table, TableCell, TableHeadCell } from "../ui/Table";
import { Textarea } from "../ui/Textarea";
import { cx, EYEBROW, MUTED, PAGE, PAGE_BAR, PANEL, PANEL_TITLE, TITLE } from "../ui/styles";
import { formatGameDate, VENUE_LABEL, versus } from "./format";
import { GameSets } from "./GameSets";
import { createRotation, playerMap, sortSquad } from "./rotation";
import { RotationEditor } from "./RotationEditor";
import { OverviewSlip } from "./OverviewSlip";
import { PositionChip } from "./PositionChip";
import { SquadDialog } from "./SquadDialog";
import { UnmatchedPlayers } from "./UnmatchedPlayers";
import { VENUES } from "./types";
import type { Game, RosterPlayer } from "./types";

// A game: its recorded sets and their stats lead, then the squad, with the rotation planning folded below. A
// coach's edits save themselves shortly after the last change and on leaving the page, and reach the game's
// sets (see gameSets.ts). Opening the page brings the two in line: roster players the sets name join the squad,
// other names are offered for matching, and sets that disagree with the game are updated. Mount it keyed by
// the game id so a different game starts a fresh draft.
type GamePageProps = {
  game: Game;
  teamName: string;
  roster: readonly RosterPlayer[];
  canEdit: boolean;
  sets: readonly SetSummary[];
  /** Sets with changes in this browser that the server does not have yet. */
  localSets: ReadonlyMap<string, Backup>;
  setsLoading: boolean;
  setsError: string | null;
  onReloadSets: () => void;
  onSave: (game: Game) => Promise<{ error: string | null; warning?: string }>;
  /** Bring the game's sets in line with it; resolves to a warning when some weren't. */
  onSyncSets: (game: Game) => Promise<string | undefined>;
  onRenameInSets: (game: Game, renames: ReadonlyMap<string, string>) => Promise<string | undefined>;
  onAddPlayers: (drafts: readonly PlayerDraft[]) => Promise<{ error: string | null; added: RosterPlayer[] }>;
  onDelete: () => void;
  onPrint: () => void;
  onOpenSet: (id: string) => void;
  onNewSet: (game: Game) => void;
  onDeleteSet: (set: SetSummary) => void;
  onImportSets: () => void;
  onStats: (game: Game) => void;
};

const SAVE_DELAY = 600;

export function GamePage({
  game,
  teamName,
  roster,
  canEdit,
  sets,
  localSets,
  setsLoading,
  setsError,
  onReloadSets,
  onSave,
  onSyncSets,
  onRenameInSets,
  onAddPlayers,
  onDelete,
  onPrint,
  onOpenSet,
  onNewSet,
  onDeleteSet,
  onImportSets,
  onStats,
}: GamePageProps): JSX.Element {
  const [draft, setDraft] = useState(game);
  const [status, setStatus] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [viewShift, setViewShift] = useState(game.overviewShift);
  const pending = useRef<Game | null>(null);
  const latest = useRef(game);
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
    void save
      .current(next)
      .then(({ error, warning }) => setStatus(error ? `Couldn’t save: ${error}` : (warning ?? "Saved")));
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
    latest.current = next;
    setDraft(next);
    pending.current = next;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY);
  };

  // Each load of the sets: roster players they name join the squad, names spelled differently from the roster
  // take its spelling, and sets that disagree with the game are updated.
  const bringInLine = ({ sets: all, stored }: GameSetData) => {
    if (!canEdit) return;

    const current = latest.current;
    const named = all.flatMap((d) => [...setPlayerNames(d)]);
    const joining = roster.filter((p) => !current.squad.includes(p.id) && named.includes(p.name)).map((p) => p.id);
    const spellings = rosterSpellingsOf(named, roster);

    if (spellings.size) void onRenameInSets(current, spellings).then((w) => w && setStatus(w));
    if (joining.length) edit({ ...current, squad: [...current.squad, ...joining] });
    else if (stored.some((d) => withGameMeta(d, current, teamName) !== d))
      void onSyncSets(current).then((w) => w && setStatus(w));
  };
  const setData = useGameSetData(game.id, sets, bringInLine);
  const unmatched = unmatchedNames(setData?.sets.flatMap((d) => [...setPlayerNames(d)]) ?? [], roster);
  const withStats = new Set(setData?.sets.flatMap((d) => [...playersWithStats(d)]));

  const matchPlayers = async (choices: Record<string, PlayerChoice>): Promise<string | null> => {
    const adding = newPlayers(choices);
    const result = adding.length ? await onAddPlayers(adding) : { error: null, added: [] };

    if (result.error) return result.error;

    const everyone = [...roster, ...result.added];
    const renames = choiceRenames(choices, everyone);
    const warning = renames.size ? await onRenameInSets(latest.current, renames) : undefined;
    const joining = Object.keys(choices).flatMap(
      (n) => everyone.find((p) => p.name === (renames.get(n) ?? n))?.id ?? []
    );

    edit({ ...latest.current, squad: [...new Set([...latest.current.squad, ...joining])] });

    return warning ?? null;
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
          {!canEdit && (draft.date || draft.opponent) && (
            <p className="m-0 mt-1 text-sm text-text-dim">
              {[versus(draft.opponent, draft.venue), draft.date && formatGameDate(draft.date)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
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
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Date" className="w-44">
            <Input
              type="date"
              value={draft.date ?? ""}
              onChange={(e) => edit({ ...draft, date: e.target.value || null })}
            />
          </Field>
          <Field label="Opponent" className="w-60">
            <Input
              value={draft.opponent}
              placeholder="None yet"
              onChange={(e) => edit({ ...draft, opponent: e.target.value })}
            />
          </Field>
          <Field label="Venue" className="w-36">
            <Select
              ariaLabel="Venue"
              value={draft.venue}
              onValueChange={(v) => edit({ ...draft, venue: VENUES.find((venue) => venue === v) ?? "home" })}
              options={VENUES.map((v) => ({ value: v, label: VENUE_LABEL[v] }))}
            />
          </Field>
        </div>
      )}

      {canEdit ? (
        <Field label="Game notes" className="max-w-2xl">
          <Textarea
            compact
            aria-label="Game notes"
            value={draft.notes}
            placeholder="Anything about this game"
            onChange={(e) => edit({ ...draft, notes: e.target.value })}
          />
        </Field>
      ) : (
        draft.notes && <p className="m-0 max-w-2xl whitespace-pre-wrap text-base text-text">{draft.notes}</p>
      )}

      <GameSets
        sets={sets}
        local={localSets}
        loading={setsLoading}
        error={setsError}
        onReload={onReloadSets}
        canEdit={canEdit}
        onOpen={(id) => {
          clearTimeout(timer.current);
          flush();
          onOpenSet(id);
        }}
        onNew={() => {
          clearTimeout(timer.current);
          flush();
          onNewSet(draft);
        }}
        onDelete={onDeleteSet}
        onImport={onImportSets}
        onStats={() => onStats(draft)}
      />

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
          {canEdit && unmatched.length > 0 && setData && (
            <UnmatchedPlayers names={unmatched} sets={setData.sets} roster={roster} onApply={matchPlayers} />
          )}
        </section>
      </div>

      <Collapsible
        defaultOpen={draft.rotations.length > 0 || draft.opponent === ""}
        className="flex max-w-4xl flex-col gap-[clamp(1rem,3vh,1.6rem)]"
      >
        <div className="flex flex-wrap items-center gap-2">
          <CollapsibleCaret label="Rotations" />
          <h2 className={PANEL_TITLE}>Rotations ({draft.rotations.length})</h2>
          <span className="flex-1" />
          <Button
            variant="ghost"
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
        <CollapsiblePanel className="flex flex-col gap-[clamp(1rem,3vh,1.6rem)]">
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
        </CollapsiblePanel>
      </Collapsible>

      {picking && (
        <SquadDialog
          game={draft}
          roster={pickable}
          locked={new Set(pickable.filter((p) => withStats.has(p.name)).map((p) => p.id))}
          onChange={edit}
          onClose={() => setPicking(false)}
        />
      )}
    </section>
  );
}
