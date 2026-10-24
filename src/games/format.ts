import { ROLES } from "../court/roles";
import { POSITIONS } from "./types";
import type { RosterPlayer } from "./types";

/** A game's fixture date for display, read as a local calendar day. */
export function formatGameDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

/** A player as one line: jersey number then name. */
export function playerLabel(player: RosterPlayer | undefined): string {
  return player ? `#${player.number} ${player.name}`.trim() : "Removed player";
}

/** The positions as select options, named in full. */
export const POSITION_OPTIONS = POSITIONS.map((p) => ({ value: p, label: ROLES[p].name }));
