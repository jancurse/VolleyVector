import type { JSX } from "react";
import { Volleyball } from "lucide-react";

import { ROLES } from "../court/roles";
import { cx } from "../ui/styles";
import { COURT_ORDER, ROMAN, shiftPositions, versionLabel } from "./lineup";
import type { Lineup, RosterPlayer } from "./types";

// One rotation slip: a paper line-up sheet for one rotated version of a lineup. A stamp names the version
// (where the setter stands), a court sketch places the six starters in their zones (front row IV-III-II
// under the net, back row V-VI-I, the server's ball at I), and the scorer's row lists them in official
// order I–VI beside the libero, the way a scorer copies a slip. Ink on paper: the role colours are the
// only colour, and each zone's role code keeps it readable in greyscale.
type RotationSlipProps = {
  teamName: string;
  lineup: Lineup;
  players: ReadonlyMap<string, RosterPlayer>;
  shift: number;
};

const INK = "border-text";

function Zone({ index, player }: { index: number; player: RosterPlayer | undefined }): JSX.Element {
  const front = index >= 1 && index <= 3;

  return (
    <div
      className={cx(
        "relative flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 pt-4 pb-1.5",
        front && "bg-[var(--court-zone)]"
      )}
    >
      <span className="absolute top-1 left-1.5 flex items-center gap-1 font-mono text-2xs font-bold text-text-dim">
        {ROMAN[index]}
        {index === 0 && <Volleyball size={11} aria-label="Serves" />}
      </span>
      {player && (
        <span
          className="absolute top-1 right-1.5 font-mono text-2xs font-bold"
          style={{ color: ROLES[player.main].ring }}
        >
          {ROLES[player.main].code}
        </span>
      )}
      <span className="font-display text-display-md font-extrabold leading-none tabular-nums">
        {player ? player.number : "–"}
      </span>
      <span className="line-clamp-2 max-w-full text-center text-2xs leading-tight break-words">
        {player?.name || " "}
      </span>
    </div>
  );
}

export function RotationSlip({ teamName, lineup, players, shift }: RotationSlipProps): JSX.Element {
  const positions = shiftPositions(lineup.positions, shift);
  const at = (id: string | null) => (id ? players.get(id) : undefined);
  const libero = at(lineup.libero);
  const label = versionLabel(lineup, players, shift);

  return (
    <article
      className={cx("flex break-inside-avoid flex-col gap-3 rounded-sm border-2 bg-white p-3 text-text", INK)}
      aria-label={`${lineup.name}, ${label}`}
    >
      <header className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="m-0 font-mono text-2xs font-bold tracking-[0.16em] text-text-dim">LINE-UP</p>
          <span className="flex-none -rotate-3 rounded-xs border-2 border-double border-accent px-1.5 py-0.5 text-center font-mono text-2xs font-bold leading-tight text-accent uppercase">
            {label}
          </span>
        </div>
        <p className="m-0 truncate font-display text-display-xs font-bold leading-tight">{teamName}</p>
      </header>

      <div className="flex flex-col">
        <div className={cx("border-t-4 border-double", INK)} aria-hidden="true" />
        <div className={cx("grid grid-cols-3 border-x-2 border-b-2", INK)}>
          {COURT_ORDER.map((index, i) => (
            <div
              key={index}
              className={cx(
                "grid border-text/25",
                i % 3 !== 2 && "border-r",
                i >= 3 && "border-t border-dashed border-t-text/60"
              )}
            >
              <Zone index={index} player={at(positions[index])} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(6,minmax(0,1fr))_auto] gap-1">
        {positions.map((id, index) => (
          <div key={index} className={cx("flex flex-col items-center rounded-xs border", INK)}>
            <span className="w-full border-b border-text/25 text-center font-mono text-2xs text-text-dim">
              {ROMAN[index]}
            </span>
            <span className="py-0.5 font-display text-sm font-bold tabular-nums">{at(id)?.number ?? " "}</span>
          </div>
        ))}
        <div
          className="ml-1 flex flex-col items-center rounded-xs border-2 px-1"
          style={{ borderColor: ROLES.libero.fill }}
        >
          <span className="w-full text-center font-mono text-2xs" style={{ color: ROLES.libero.fill }}>
            L
          </span>
          <span className="py-0.5 font-display text-sm font-bold tabular-nums">{libero?.number ?? " "}</span>
        </div>
      </div>

      <div className="flex items-end gap-2 pt-1 text-2xs text-text-dim">
        <span className="font-mono">Coach</span>
        <span className="h-px flex-1 bg-text/40" aria-hidden="true" />
      </div>
    </article>
  );
}
