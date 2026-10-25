import type { JSX } from "react";

import { ROLES } from "../court/roles";
import { slipName } from "./format";
import { overviewZones, ROMAN } from "./rotation";
import { SlipCourt } from "./SlipCourt";
import { SlipFrame } from "./SlipFrame";
import type { RosterPlayer } from "./types";

// The game's overview slip: every squad player at the position a 5-1 gives their main role, the setter in I
// shifted by `shift`. An outside or middle is listed in both zones of their role, since either is theirs to
// take. Liberos sit in their own row below the court.
type OverviewSlipProps = {
  teamName: string;
  squad: readonly RosterPlayer[];
  shift: number;
  onRotate?: (steps: number) => void;
  compact?: boolean;
};

function PlayerLines({ players }: { players: readonly RosterPlayer[] }): JSX.Element {
  return (
    <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
      {players.map((p) => (
        <li key={p.id} className="flex min-w-0 items-baseline gap-1.5 text-2xs leading-tight">
          <span className="w-5 flex-none text-right font-display text-sm font-extrabold tabular-nums">{p.number}</span>
          <span className="truncate">{slipName(p)}</span>
        </li>
      ))}
    </ul>
  );
}

export function OverviewSlip({ teamName, squad, shift, onRotate, compact }: OverviewSlipProps): JSX.Element {
  const { roles, zones, liberos } = overviewZones(squad, shift);

  return (
    <SlipFrame
      caption="Overview"
      title={teamName}
      stamp={`Setter in ${ROMAN[roles.indexOf("setter")]}`}
      ariaLabel="Overview"
      onRotate={onRotate}
      compact={compact}
    >
      <SlipCourt
        compact={compact}
        zone={(index) => (
          <div className="relative flex min-w-0 flex-col gap-1 px-1.5 pt-5 pb-1.5">
            <span
              className="absolute top-1 right-1.5 font-mono text-2xs font-bold"
              style={{ color: ROLES[roles[index]].ring }}
            >
              {ROLES[roles[index]].code}
            </span>
            {zones[index].length ? (
              <PlayerLines players={zones[index]} />
            ) : (
              <span className="text-center text-2xs text-text-dim">–</span>
            )}
          </div>
        )}
      />
      <div
        className="flex items-start gap-3 rounded-xs border-2 px-2 py-1.5"
        style={{ borderColor: ROLES.libero.fill }}
      >
        <span className="font-mono text-2xs font-bold" style={{ color: ROLES.libero.fill }}>
          L
        </span>
        {liberos.length ? <PlayerLines players={liberos} /> : <span className="text-2xs text-text-dim">–</span>}
      </div>
    </SlipFrame>
  );
}
