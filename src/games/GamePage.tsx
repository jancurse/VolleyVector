import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import {
  BarChart3,
  Check,
  Clapperboard,
  Ellipsis,
  FileText,
  LayoutList,
  Pencil,
  Plus,
  Printer,
  RotateCw,
  Users,
} from "lucide-react";

import type { StatsTab } from "../stats/StatsPage";
import { playersWithStats, setPlayerNames } from "../stats/gameSets";
import { choiceRenames, newPlayers, unmatchedNames } from "../stats/matchPlayers";
import type { PlayerChoice } from "../stats/matchPlayers";
import type { SetSummary } from "../stats/types";
import type { Backup } from "../stats/sync/setSync";
import { useGameSetData } from "../stats/useGameSetData";
import type { PlayerDraft } from "./useRoster";

import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { Input } from "../ui/Input";
import { Menu, MenuItem } from "../ui/Menu";
import { Select } from "../ui/Select";
import { Table, TableCell, TableHeadCell } from "../ui/Table";
import { GuideLink } from "../guide/GuideLink";
import { Tab, TabList, Tabs } from "../ui/Tabs";
import { Textarea } from "../ui/Textarea";
import { cx, EYEBROW, FIELD_LABEL, MUTED, PAGE, PAGE_BAR, PANEL, PANEL_TITLE, TITLE } from "../ui/styles";
import { formatGameDate, VENUE_LABEL } from "./format";
import { GameSets } from "./GameSets";
import { createRotation, playerMap, sortSquad } from "./rotation";
import { RotationEditor } from "./RotationEditor";
import { OverviewSlip } from "./OverviewSlip";
import { PositionChip } from "./PositionChip";
import { SquadDialog } from "./SquadDialog";
import { UnmatchedPlayers } from "./UnmatchedPlayers";
import { VENUES } from "./types";
import type { Game, RosterPlayer } from "./types";
import type { GameTab } from "../routing/route";

// A game in five tabs: the overview (its details, recorded sets, and squad), the rotations, and its sets' stats,
// highlights, and match report. A coach's edits save themselves shortly after the last change and on leaving the
// page, and a squad change reaches the game's sets (see gameSets.ts). Opening the page writes nothing: names in the
// sets with no roster player are offered for matching, which changes the sets only when the coach applies it. Mount
// it keyed by the game id so a different game starts a fresh draft.
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
  onRenameInSets: (game: Game, renames: ReadonlyMap<string, string>) => Promise<string | undefined>;
  onAddPlayers: (drafts: readonly PlayerDraft[]) => Promise<{ error: string | null; added: RosterPlayer[] }>;
  onDelete: () => void;
  onPrint: () => void;
  onOpenSet: (id: string) => void;
  /** Add the game's next set; resolves once it is listed. */
  onNewSet: (game: Game) => Promise<void>;
  onDeleteSet: (set: SetSummary) => void;
  onImportSets: () => void;
  /** Type in a set's score; resolves to an error, or null once saved. */
  onScoreSet: (set: SetSummary, score: { us: number; them: number }) => Promise<string | null>;
  tab: GameTab | StatsTab;
  onTab: (tab: GameTab | StatsTab) => void;
};

const TABS: readonly (GameTab | StatsTab)[] = ["overview", "rotations", "stats", "highlights", "report"];

const SAVE_DELAY = 600;

/** One of a game's details, shown as text. */
function Detail({ label, value }: { label: string; value: string | null }): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <dt className={FIELD_LABEL}>{label}</dt>
      <dd className={cx("m-0 text-base whitespace-pre-wrap", value ? "text-text" : "text-text-dim")}>
        {value || "None"}
      </dd>
    </div>
  );
}

// The stats are heavy (YouTube, Chart.js, jsPDF), so they load when the tab is first shown.
const GameStats = lazy(() => import("../stats/GameStats").then((m) => ({ default: m.GameStats })));

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
  onRenameInSets,
  onAddPlayers,
  onDelete,
  onPrint,
  onOpenSet,
  onNewSet,
  onDeleteSet,
  onImportSets,
  onScoreSet,
  tab,
  onTab,
}: GamePageProps): JSX.Element {
  const [draft, setDraft] = useState(game);
  const [status, setStatus] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  // A game with no details yet opens with them in the form; otherwise they show as text until edited.
  const [editingDetails, setEditingDetails] = useState(canEdit && !game.date && !game.opponent && !game.notes);
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

  const setData = useGameSetData(game.id, sets);
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

      <Tabs
        value={tab}
        onValueChange={(v) => onTab(TABS.find((t) => t === v) ?? "overview")}
        className="flex items-center gap-2"
      >
        <TabList ariaLabel="Game">
          <Tab value="overview">
            <span className="flex items-center gap-1.5">
              <LayoutList size={15} aria-hidden="true" /> Overview
            </span>
          </Tab>
          <Tab value="rotations">
            <span className="flex items-center gap-1.5">
              <RotateCw size={15} aria-hidden="true" /> Rotations
            </span>
          </Tab>
          <Tab value="stats">
            <span className="flex items-center gap-1.5">
              <BarChart3 size={15} aria-hidden="true" /> Stats
            </span>
          </Tab>
          <Tab value="highlights">
            <span className="flex items-center gap-1.5">
              <Clapperboard size={15} aria-hidden="true" /> Highlights
            </span>
          </Tab>
          <Tab value="report">
            <span className="flex items-center gap-1.5">
              <FileText size={15} aria-hidden="true" /> Match report
            </span>
          </Tab>
        </TabList>
        <GuideLink topic={tab === "overview" || tab === "rotations" ? "games" : tab === "stats" ? "read-stats" : tab} />
      </Tabs>

      {tab === "overview" && (
        <>
          {/* The details are as wide as the Sets card, their toggle at the right end of the first row. */}
          <div className="flex max-w-2xl flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              {editingDetails ? (
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="Date" className="w-44">
                    <Input
                      type="date"
                      value={draft.date ?? ""}
                      onChange={(e) => edit({ ...draft, date: e.target.value || null })}
                    />
                  </Field>
                  <Field label="Opponent" className="w-52">
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
              ) : (
                <dl className="m-0 flex flex-wrap gap-x-8 gap-y-4">
                  {(
                    [
                      ["Date", draft.date && formatGameDate(draft.date)],
                      ["Opponent", draft.opponent],
                      ["Venue", VENUE_LABEL[draft.venue]],
                    ] as const
                  ).map(([label, value]) => (
                    <Detail key={label} label={label} value={value} />
                  ))}
                </dl>
              )}
              {canEdit &&
                (editingDetails ? (
                  <Button variant="ghost" paired onClick={() => setEditingDetails(false)}>
                    <Check size={15} aria-hidden="true" /> Done
                  </Button>
                ) : (
                  <Button variant="ghost" paired onClick={() => setEditingDetails(true)}>
                    <Pencil size={15} aria-hidden="true" /> Edit details
                  </Button>
                ))}
            </div>
            {editingDetails ? (
              <Field label="Game notes">
                <Textarea
                  compact
                  aria-label="Game notes"
                  value={draft.notes}
                  placeholder="Anything about this game"
                  onChange={(e) => edit({ ...draft, notes: e.target.value })}
                />
              </Field>
            ) : (
              <dl className="m-0">
                <Detail label="Game notes" value={draft.notes} />
              </dl>
            )}
          </div>

          <div className="flex flex-wrap items-start gap-[clamp(1rem,3vh,1.6rem)]">
            <GameSets
              sets={sets}
              local={localSets}
              loading={setsLoading}
              error={setsError}
              onReload={onReloadSets}
              data={setData?.byId}
              canEdit={canEdit}
              onOpen={(id) => {
                clearTimeout(timer.current);
                flush();
                onOpenSet(id);
              }}
              onNew={() => {
                clearTimeout(timer.current);
                flush();

                return onNewSet(draft);
              }}
              onDelete={onDeleteSet}
              onImport={onImportSets}
              onScore={onScoreSet}
            />
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
        </>
      )}

      {tab === "rotations" && (
        <>
          <div className="flex max-w-4xl flex-col gap-[clamp(1rem,3vh,1.6rem)]">
            <div className="flex flex-wrap items-center gap-2">
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
          </div>
        </>
      )}

      {(tab === "stats" || tab === "highlights" || tab === "report") && (
        <Suspense fallback={<p className={MUTED}>Loading…</p>}>
          <GameStats
            gameIds={[game.id]}
            games={[draft]}
            teamName={teamName}
            roster={roster}
            tab={tab}
            onTab={onTab}
            embedded
          />
        </Suspense>
      )}

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
