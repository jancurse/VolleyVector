import type { JSX } from "react";
import { Plus } from "lucide-react";

import { Button } from "../ui/Button";
import { Table, TableCell, TableHeadCell } from "../ui/Table";
import { EYEBROW, MUTED, PAGE, PAGE_BAR, TITLE } from "../ui/styles";
import { formatGameDate } from "./format";
import type { Game } from "./types";

// A team's games, newest fixture first. A coach starts a new one here; anyone on the team opens one to see
// its lineups and print its rotation slips.
type GamesPageProps = {
  teamName: string;
  games: readonly Game[];
  loading: boolean;
  canEdit: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
};

export function GamesPage({ teamName, games, loading, canEdit, onOpen, onNew }: GamesPageProps): JSX.Element {
  return (
    <section className={PAGE}>
      <div className={PAGE_BAR}>
        <div>
          <p className={EYEBROW}>{teamName}</p>
          <h1 className={TITLE}>Games</h1>
        </div>
        {canEdit && (
          <Button variant="primary" onClick={onNew}>
            <Plus size={15} aria-hidden="true" />
            New game
          </Button>
        )}
      </div>

      {loading ? (
        <p className={MUTED}>Loading…</p>
      ) : games.length === 0 ? (
        <p className={MUTED}>
          {canEdit
            ? "Start a game to pick a squad, set your lineups, and print rotation slips."
            : "No games planned yet."}
        </p>
      ) : (
        <Table>
          <thead>
            <tr>
              <TableHeadCell>Game</TableHeadCell>
              <TableHeadCell>Date</TableHeadCell>
              <TableHeadCell className="text-right">Lineups</TableHeadCell>
            </tr>
          </thead>
          <tbody>
            {games.map((game) => (
              <tr key={game.id}>
                <TableCell className="max-w-xs truncate">
                  <Button variant="text" className="pl-0 text-base text-text" onClick={() => onOpen(game.id)}>
                    {game.name || "Untitled game"}
                  </Button>
                </TableCell>
                <TableCell className="text-text-dim">{game.date ? formatGameDate(game.date) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{game.lineups.length}</TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
}
