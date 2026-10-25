import { ROLES } from "../court/roles";
import { POSITIONS } from "./types";
import type { RosterPlayer } from "./types";

// Read as a local calendar day, not UTC midnight.
export function formatGameDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

export function playerLabel(player: RosterPlayer | undefined): string {
  return player ? `#${player.number} ${player.name}`.trim() : "Removed player";
}

export const slipName = (player: RosterPlayer): string => player.shortName || player.name;

export const POSITION_OPTIONS = POSITIONS.map((p) => ({ value: p, label: ROLES[p].name }));
