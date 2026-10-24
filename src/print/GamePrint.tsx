import type { JSX } from "react";

import { formatGameDate, playerLabel } from "../games/format";
import { playerMap, sortShifts } from "../games/lineup";
import { RotationSlip } from "../games/RotationSlip";
import type { Game, RosterPlayer } from "../games/types";
import { EYEBROW } from "../ui/styles";

// A game's rotation slips as a printable document. Each lineup starts its own section: its chosen rotated
// versions sit side by side, three to a row, followed once by its planned subs and notes. A lineup with no
// version chosen is left out.
type GamePrintProps = {
  game: Game;
  teamName: string;
  roster: readonly RosterPlayer[];
};

export function GamePrint({ game, teamName, roster }: GamePrintProps): JSX.Element {
  const players = playerMap(roster);
  const label = (id: string) => playerLabel(players.get(id));
  const lineups = game.lineups.filter((l) => l.printShifts.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b-2 border-text pb-3">
        <p className={EYEBROW}>{teamName}</p>
        <h1 className="m-0 font-display text-display-md font-bold">{game.name || "Untitled game"}</h1>
        {game.date && <p className="m-0 mt-1 text-sm text-text-dim">{formatGameDate(game.date)}</p>}
      </header>

      {lineups.length === 0 && <p className="m-0 italic text-text-dim">No lineup has a version chosen to print.</p>}

      {lineups.map((lineup) => {
        const subs = lineup.positions.flatMap((id) =>
          id && lineup.alternates[id]?.length ? [{ starter: id, alts: lineup.alternates[id] }] : []
        );

        return (
          <section key={lineup.id} className="flex flex-col gap-3">
            <h2 className="m-0 break-after-avoid font-display text-display-sm font-bold">{lineup.name}</h2>
            <div className="grid grid-cols-3 gap-4">
              {sortShifts(lineup, players, lineup.printShifts).map((shift) => (
                <RotationSlip key={shift} teamName={teamName} lineup={lineup} players={players} shift={shift} />
              ))}
            </div>
            {(subs.length > 0 || lineup.notes.trim()) && (
              <div className="grid break-inside-avoid grid-cols-2 gap-6 text-sm">
                {subs.length > 0 && (
                  <div>
                    <p className={EYEBROW}>Planned subs</p>
                    <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                      {subs.map(({ starter, alts }) => (
                        <li key={starter}>
                          <span className="font-semibold">{label(starter)}</span>
                          <span className="text-text-dim"> ⇄ </span>
                          {alts.map(label).join(", ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {lineup.notes.trim() && (
                  <div>
                    <p className={EYEBROW}>Notes</p>
                    <p className="m-0 whitespace-pre-line">{lineup.notes}</p>
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
