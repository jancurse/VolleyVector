import type { JSX } from "react";

import { ROLES } from "../court/roles";
import type { RosterPlayer } from "./types";

// One starter in a slip zone: the jersey number large, the name below, and the main position's code in the
// role's ring colour at the corner, so the zone reads in greyscale too. An empty zone shows a dash.
export function ZonePlayer({ player }: { player: RosterPlayer | undefined }): JSX.Element {
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
        {player?.name || " "}
      </span>
    </span>
  );
}
