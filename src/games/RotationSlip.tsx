import type { JSX, ReactNode } from "react";

import { ROLES } from "../court/roles";
import { slipName } from "./format";
import { ROMAN, shiftPositions, versionLabel } from "./rotation";
import { SlipCourt } from "./SlipCourt";
import { SlipFrame } from "./SlipFrame";
import type { Rotation, RosterPlayer } from "./types";

// A rotation at one shift as a paper slip. Each zone shows its role code so it reads in greyscale.
// The editor passes `zone` and `libero` to wrap those cells in pickers; print passes `compact`.
type RotationSlipProps = {
  teamName: string;
  rotation: Rotation;
  players: ReadonlyMap<string, RosterPlayer>;
  shift: number;
  onRotate?: (steps: number) => void;
  zone?: (index: number, content: ReactNode) => ReactNode;
  libero?: (content: ReactNode) => ReactNode;
  compact?: boolean;
};

function ZonePlayer({ player }: { player: RosterPlayer | undefined }): JSX.Element {
  return (
    <span className="relative flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 pt-4 pb-1.5">
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
        {player ? slipName(player) : " "}
      </span>
    </span>
  );
}

export function RotationSlip({
  teamName,
  rotation,
  players,
  shift,
  onRotate,
  zone = (_, content) => content,
  libero = (content) => content,
  compact,
}: RotationSlipProps): JSX.Element {
  const positions = shiftPositions(rotation.positions, shift);
  const at = (id: string | null) => (id ? players.get(id) : undefined);
  const liberoPlayer = at(rotation.libero);
  const label = versionLabel(rotation, players, shift);

  return (
    <SlipFrame
      caption="Rotation"
      title={teamName}
      stamp={label}
      ariaLabel={`${rotation.name}, ${label}`}
      onRotate={onRotate}
      compact={compact}
    >
      <SlipCourt compact={compact} zone={(index) => zone(index, <ZonePlayer player={at(positions[index])} />)} />

      <div className="grid overflow-hidden rounded-xs border-2" style={{ borderColor: ROLES.libero.fill }}>
        {libero(
          <span className="flex min-w-0 items-baseline gap-2 px-2 py-1">
            <span className="font-mono text-2xs font-bold" style={{ color: ROLES.libero.fill }}>
              L
            </span>
            <span className="font-display text-display-md font-extrabold leading-none tabular-nums">
              {liberoPlayer?.number ?? "–"}
            </span>
            <span className="truncate text-sm">{liberoPlayer && slipName(liberoPlayer)}</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-[repeat(6,minmax(0,1fr))_auto] gap-1">
        {positions.map((id, index) => (
          <div key={index} className="flex flex-col items-center rounded-xs border border-text">
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
          <span className="py-0.5 font-display text-sm font-bold tabular-nums">{liberoPlayer?.number ?? " "}</span>
        </div>
      </div>

      <div className="flex items-end gap-2 pt-1 text-2xs text-text-dim">
        <span className="font-mono">Coach</span>
        <span className="h-px flex-1 bg-text/40" aria-hidden="true" />
      </div>
    </SlipFrame>
  );
}
