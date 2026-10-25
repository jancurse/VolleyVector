import { useState } from "react";
import type { JSX } from "react";

import { formatGameDate, playerLabel } from "../games/format";
import { playerMap, ROMAN, sortShifts, sortSquad } from "../games/rotation";
import { OverviewSlip } from "../games/OverviewSlip";
import { PositionChip } from "../games/PositionChip";
import { RotationSlip } from "../games/RotationSlip";
import type { Game, RosterPlayer } from "../games/types";
import { Toggle } from "../ui/Toggle";
import { FIELD_LABEL, cx } from "../ui/styles";
import { PrintView } from "./PrintView";

// The squad and the overview are optional and sit side by side above the rotations. A rotation with no version
// chosen to print is left out.
type GamePrintProps = {
  game: Game;
  teamName: string;
  roster: readonly RosterPlayer[];
  onBack: () => void;
};

export function GamePrint({ game, teamName, roster, onBack }: GamePrintProps): JSX.Element {
  const [withSquad, setWithSquad] = useState(true);
  const [withOverview, setWithOverview] = useState(true);
  const players = playerMap(roster, game.overrides);
  const label = (id: string) => playerLabel(players.get(id));
  const rotations = game.rotations.filter((l) => l.printShifts.length > 0);
  const squad = sortSquad(game.squad.flatMap((id) => players.get(id) ?? []));

  return (
    <PrintView
      title={`${game.name || "Untitled game"} — rotation slips`}
      onBack={onBack}
      options={
        <>
          <Toggle ariaLabel="Print the squad" pressed={withSquad} onPressedChange={setWithSquad}>
            Squad
          </Toggle>
          <Toggle ariaLabel="Print the overview" pressed={withOverview} onPressedChange={setWithOverview}>
            Overview
          </Toggle>
        </>
      }
    >
      <div className="print-slips flex flex-col gap-4">
        <header className="flex items-end justify-between gap-4 border-b-2 border-text pb-3">
          <div className="min-w-0">
            <p className={cx(FIELD_LABEL, "m-0")}>{teamName}</p>
            <h1 className="m-0 font-display text-display-md font-bold leading-tight">{game.name || "Untitled game"}</h1>
          </div>
          {game.date && <p className="m-0 flex-none text-sm text-text-dim">{formatGameDate(game.date)}</p>}
        </header>

        {squad.length > 0 && (withSquad || withOverview) && (
          <div className="flex break-inside-avoid items-start gap-5">
            {withSquad && (
              <section className="flex min-w-0 flex-1 flex-col gap-2">
                <h2 className="m-0 font-display text-display-sm font-bold">Squad</h2>
                <table className="w-full border-collapse text-left text-sm">
                  <tbody>
                    {squad.map((p) => (
                      <tr key={p.id} className="border-b border-text/15 last:border-0">
                        <td className="w-8 py-0.5 pr-2 text-right font-display font-bold tabular-nums">{p.number}</td>
                        <td className="py-0.5 pr-2">{p.name}</td>
                        <td className="py-0.5 text-right whitespace-nowrap">
                          <span className="inline-flex gap-1">
                            <PositionChip position={p.main} />
                            {p.secondary.map((s) => (
                              <PositionChip key={s} position={s} secondary />
                            ))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
            {withOverview && (
              <section className="flex w-[42%] flex-none flex-col gap-2">
                <h2 className="m-0 font-display text-display-sm font-bold">Overview</h2>
                <OverviewSlip teamName={teamName} squad={squad} shift={game.overviewShift} compact />
              </section>
            )}
          </div>
        )}

        {rotations.length === 0 && (
          <p className="m-0 italic text-text-dim">No rotation has a version chosen to print.</p>
        )}

        {rotations.map((rotation) => {
          const subs = rotation.positions.flatMap((id, index) =>
            id && rotation.alternates[id]?.length ? [{ starter: id, index, alts: rotation.alternates[id] }] : []
          );

          return (
            <section key={rotation.id} className="flex break-inside-avoid flex-col gap-2">
              <h2 className="m-0 font-display text-display-sm font-bold">{rotation.name}</h2>
              <div className="grid grid-cols-3 gap-2">
                {sortShifts(rotation, players, rotation.printShifts).map((shift) => (
                  <RotationSlip
                    key={shift}
                    teamName={teamName}
                    rotation={rotation}
                    players={players}
                    shift={shift}
                    compact
                  />
                ))}
              </div>
              {(subs.length > 0 || rotation.notes.trim()) && (
                <div className="grid grid-cols-2 gap-6 border-t border-text/25 pt-2 text-sm">
                  {subs.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <p className={cx(FIELD_LABEL, "m-0")}>Planned subs</p>
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
                  {rotation.notes.trim() && (
                    <div className="flex flex-col gap-1.5">
                      <p className={cx(FIELD_LABEL, "m-0")}>Notes</p>
                      <p className="m-0 whitespace-pre-line">{rotation.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </PrintView>
  );
}
