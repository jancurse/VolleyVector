import type { JSX } from "react";

import { formatGameDate, playerLabel } from "../games/format";
import { playerMap, ROMAN, sortShifts } from "../games/lineup";
import { OverviewSlip } from "../games/OverviewSlip";
import { RotationSlip } from "../games/RotationSlip";
import type { Game, RosterPlayer } from "../games/types";
import { FIELD_LABEL, cx } from "../ui/styles";

// A game's rotation slips as a printable document. The overview slip leads when the coach chose to print it.
// Each lineup then keeps together as one block: its name, its chosen rotated versions three to a row, and
// once below them its possible subs and notes. A lineup with no version chosen is left out.
type GamePrintProps = {
  game: Game;
  teamName: string;
  roster: readonly RosterPlayer[];
};

export function GamePrint({ game, teamName, roster }: GamePrintProps): JSX.Element {
  const players = playerMap(roster, game.overrides);
  const label = (id: string) => playerLabel(players.get(id));
  const lineups = game.lineups.filter((l) => l.printShifts.length > 0);
  const squad = game.squad.flatMap((id) => players.get(id) ?? []);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4 border-b-2 border-text pb-3">
        <div className="min-w-0">
          <p className={cx(FIELD_LABEL, "m-0")}>{teamName}</p>
          <h1 className="m-0 font-display text-display-md font-bold leading-tight">{game.name || "Untitled game"}</h1>
        </div>
        {game.date && <p className="m-0 flex-none text-sm text-text-dim">{formatGameDate(game.date)}</p>}
      </header>

      {game.overview.print && squad.length > 0 && (
        <section className="flex break-inside-avoid flex-col gap-3">
          <h2 className="m-0 font-display text-display-sm font-bold">Overview</h2>
          <div className="w-1/3">
            <OverviewSlip teamName={teamName} squad={squad} shift={game.overview.shift} />
          </div>
        </section>
      )}

      {lineups.length === 0 && !game.overview.print && (
        <p className="m-0 italic text-text-dim">No lineup has a version chosen to print.</p>
      )}

      {lineups.map((lineup) => {
        const subs = lineup.positions.flatMap((id, index) =>
          id && lineup.alternates[id]?.length ? [{ starter: id, index, alts: lineup.alternates[id] }] : []
        );

        return (
          <section key={lineup.id} className="flex break-inside-avoid flex-col gap-3">
            <h2 className="m-0 font-display text-display-sm font-bold">{lineup.name}</h2>
            <div className="grid grid-cols-3 gap-3">
              {sortShifts(lineup, players, lineup.printShifts).map((shift) => (
                <RotationSlip key={shift} teamName={teamName} lineup={lineup} players={players} shift={shift} />
              ))}
            </div>
            {(subs.length > 0 || lineup.notes.trim()) && (
              <div className="grid grid-cols-2 gap-6 border-t border-text/25 pt-3 text-sm">
                {subs.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className={cx(FIELD_LABEL, "m-0")}>Possible subs</p>
                    <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                      {subs.map(({ starter, index, alts }) => (
                        <li key={starter} className="flex gap-2">
                          <span className="w-6 flex-none font-mono text-2xs leading-5 text-text-dim">
                            {ROMAN[index]}
                          </span>
                          <span>
                            <span className="font-semibold">{label(starter)}</span>
                            <span className="text-text-dim"> ⇄ </span>
                            {alts.map(label).join(", ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {lineup.notes.trim() && (
                  <div className="flex flex-col gap-1.5">
                    <p className={cx(FIELD_LABEL, "m-0")}>Notes</p>
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
