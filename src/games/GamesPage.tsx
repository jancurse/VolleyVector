import { useState } from "react";
import type { JSX } from "react";
import { BarChart3, Plus, Upload, Users } from "lucide-react";

import { ResultBadge } from "../stats/ResultBadge";
import type { SetSummary } from "../stats/types";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Table, TableCell, TableHeadCell } from "../ui/Table";
import { EYEBROW, MUTED, PAGE, PAGE_BAR, THEM_TEXT, TITLE } from "../ui/styles";
import { formatShortDate, VENUE_LABEL } from "./format";
import type { Game } from "./types";

// A team's games, newest fixture first, with each game's opponent and set scores. A coach starts a new game or
// imports recorded set files here; anyone on the team opens one, picks games for their combined stats, or opens
// the roster the squads are picked from.
type GamesPageProps = {
  teamName: string;
  games: readonly Game[];
  sets: readonly SetSummary[];
  loading: boolean;
  canEdit: boolean;
  onOpen: (id: string) => void;
  onOpenSet: (gameId: string, setId: string) => void;
  onNew: () => void;
  onOpenRoster: () => void;
  onImport: () => void;
  onStats: (games: readonly Game[]) => void;
};

export function GamesPage({
  teamName,
  games,
  sets,
  loading,
  canEdit,
  onOpen,
  onOpenSet,
  onNew,
  onOpenRoster,
  onImport,
  onStats,
}: GamesPageProps): JSX.Element {
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const setsOf = (id: string) => sets.filter((s) => s.gameId === id);
  const pickedGames = games.filter((g) => picked.has(g.id));
  // Only games with stats recorded: a set with a typed-in score alone has none.
  // A game can be picked once a set of it has saved stats with something recorded, not just a typed-in score.
  const pickable = games.filter((g) => setsOf(g.id).some((s) => s.statsSaved && s.touches > 0));
  const allPicked = pickable.length > 0 && pickable.every((g) => picked.has(g.id));

  const pick = (id: string, on: boolean) =>
    setPicked((p) => {
      const next = new Set(p);

      if (on) next.add(id);
      else next.delete(id);

      return next;
    });

  return (
    <section className={PAGE}>
      <div className={PAGE_BAR}>
        <div>
          <p className={EYEBROW}>{teamName}</p>
          <h1 className={TITLE}>Games</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" paired={canEdit} onClick={onOpenRoster}>
            <Users size={15} aria-hidden="true" />
            Roster
          </Button>
          {canEdit && (
            <>
              <Button variant="ghost" paired onClick={onImport}>
                <Upload size={15} aria-hidden="true" />
                Import set files
              </Button>
              <Button variant="primary" onClick={onNew}>
                <Plus size={15} aria-hidden="true" />
                New game
              </Button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <p className={MUTED}>Loading…</p>
      ) : games.length === 0 ? (
        <p className={MUTED}>
          {canEdit
            ? "Start a game to pick a squad, record its sets, and see their stats. Or import sets recorded earlier."
            : "No games yet."}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" onClick={() => onStats(pickedGames)} disabled={pickedGames.length === 0}>
              <BarChart3 size={15} aria-hidden="true" />
              Stats for {pickedGames.length || "picked"} {pickedGames.length === 1 ? "game" : "games"}
            </Button>
            {pickedGames.length > 0 && (
              <Button variant="text" onClick={() => setPicked(new Set())}>
                Clear
              </Button>
            )}
          </div>
          <Table width="page">
            <thead>
              <tr>
                <TableHeadCell className="w-px">
                  <Checkbox
                    checked={allPicked}
                    onCheckedChange={(on) => setPicked(new Set(on ? pickable.map((g) => g.id) : []))}
                    ariaLabel="Pick every game with stats"
                    disabled={pickable.length === 0}
                  />
                </TableHeadCell>
                <TableHeadCell>Game</TableHeadCell>
                <TableHeadCell>Opponent</TableHeadCell>
                <TableHeadCell>Venue</TableHeadCell>
                <TableHeadCell>Date</TableHeadCell>
                <TableHeadCell>Result</TableHeadCell>
                <TableHeadCell>Sets</TableHeadCell>
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <tr key={game.id}>
                  <TableCell>
                    <Checkbox
                      checked={picked.has(game.id)}
                      onCheckedChange={(on) => pick(game.id, on)}
                      ariaLabel={`Pick ${game.name || "this game"} for stats`}
                      disabled={!pickable.includes(game)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="text"
                      className="max-w-xs pl-0 text-base"
                      onClick={() => onOpen(game.id)}
                      title={game.name}
                    >
                      <span className="truncate text-text">{game.name || "Untitled game"}</span>
                    </Button>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-text-dim">{game.opponent || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-text-dim">{VENUE_LABEL[game.venue]}</TableCell>
                  <TableCell className="whitespace-nowrap text-text-dim tabular-nums">
                    {game.date ? formatShortDate(game.date) : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {setsOf(game.id).length === 0 ? (
                      <span className="text-text-dim">—</span>
                    ) : (
                      <ResultBadge sets={setsOf(game.id)} />
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {setsOf(game.id).length === 0 ? (
                      <span className="text-text-dim">—</span>
                    ) : (
                      <span className="flex items-center gap-4">
                        {setsOf(game.id).map((s) => (
                          <Button
                            key={s.id}
                            variant="text"
                            size="sm"
                            disabled={!canEdit}
                            onClick={() => onOpenSet(game.id, s.id)}
                            title={canEdit ? `Open set ${s.setNumber} in the tracker` : `Set ${s.setNumber}`}
                            aria-label={`Set ${s.setNumber}, ${s.statsSaved ? `${s.us}–${s.them}` : "no stats yet"}`}
                            className="p-0 text-sm disabled:opacity-100"
                          >
                            {s.statsSaved ? (
                              <span className={s.them > s.us ? THEM_TEXT : "text-text"}>
                                {s.us}–{s.them}
                              </span>
                            ) : (
                              <span className="text-text-dim">–</span>
                            )}
                          </Button>
                        ))}
                      </span>
                    )}
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </section>
  );
}
