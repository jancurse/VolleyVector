import type { JSX, ReactNode } from "react";

import { ROLES } from "../court/roles";
import { ROMAN, shiftPositions, versionLabel } from "./lineup";
import { SlipCourt } from "./SlipCourt";
import { SlipFrame } from "./SlipFrame";
import { ZonePlayer } from "./ZonePlayer";
import type { Lineup, RosterPlayer } from "./types";

// One rotation slip: a paper line-up sheet for one rotated version of a lineup. A stamp names the version
// (where the setter stands), the court sketch places the six starters in their zones, and the scorer's row
// lists them in official order I–VI beside the libero, the way a scorer copies a slip. Ink on paper: the
// role colours are the only colour, and each zone's role code keeps it readable in greyscale. The editor
// passes `zone` and `libero` to wrap those cells in pickers, and `onRotate` to put rotate buttons on it.
type RotationSlipProps = {
  teamName: string;
  lineup: Lineup;
  players: ReadonlyMap<string, RosterPlayer>;
  shift: number;
  onRotate?: (steps: number) => void;
  zone?: (index: number, content: ReactNode) => ReactNode;
  libero?: (content: ReactNode) => ReactNode;
};

export function RotationSlip({
  teamName,
  lineup,
  players,
  shift,
  onRotate,
  zone = (_, content) => content,
  libero = (content) => content,
}: RotationSlipProps): JSX.Element {
  const positions = shiftPositions(lineup.positions, shift);
  const at = (id: string | null) => (id ? players.get(id) : undefined);
  const label = versionLabel(lineup, players, shift);

  return (
    <SlipFrame
      caption="Line-up"
      title={teamName}
      stamp={label}
      ariaLabel={`${lineup.name}, ${label}`}
      onRotate={onRotate}
    >
      <SlipCourt zone={(index) => zone(index, <ZonePlayer player={at(positions[index])} />)} />

      <div className="grid grid-cols-[repeat(6,minmax(0,1fr))_auto] gap-1">
        {positions.map((id, index) => (
          <div key={index} className="flex flex-col items-center rounded-xs border border-text">
            <span className="w-full border-b border-text/25 text-center font-mono text-2xs text-text-dim">
              {ROMAN[index]}
            </span>
            <span className="py-0.5 font-display text-sm font-bold tabular-nums">{at(id)?.number ?? " "}</span>
          </div>
        ))}
        <div className="ml-1 grid overflow-hidden rounded-xs border-2" style={{ borderColor: ROLES.libero.fill }}>
          {libero(
            <span className="flex flex-col items-center px-1">
              <span className="w-full text-center font-mono text-2xs" style={{ color: ROLES.libero.fill }}>
                L
              </span>
              <span className="py-0.5 font-display text-sm font-bold tabular-nums">
                {at(lineup.libero)?.number ?? " "}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-end gap-2 pt-1 text-2xs text-text-dim">
        <span className="font-mono">Coach</span>
        <span className="h-px flex-1 bg-text/40" aria-hidden="true" />
      </div>
    </SlipFrame>
  );
}
