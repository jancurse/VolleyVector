import { ROLES } from "../court/roles";
import { POSITIONS } from "./types";
import type { RosterPlayer, Venue } from "./types";

// Read as a local calendar day, not UTC midnight. A date that isn't one (a set file may hold any text) shows as it is.
function formatDay(date: string, month: "long" | "short"): string {
  const day = new Date(`${date}T00:00:00`);

  return Number.isNaN(day.getTime())
    ? date
    : day.toLocaleDateString(undefined, { day: "numeric", month, year: "numeric" });
}

/** "17 October 2026". */
export const formatGameDate = (date: string): string => formatDay(date, "long");

/** "17 Oct 2026", for a table column. */
export const formatShortDate = (date: string): string => formatDay(date, "short");

export function playerLabel(player: RosterPlayer | undefined): string {
  return player ? `#${player.number} ${player.name}`.trim() : "Removed player";
}

export const slipName = (player: RosterPlayer): string => player.shortName || player.name;

export const POSITION_OPTIONS = POSITIONS.map((p) => ({ value: p, label: ROLES[p].name }));

export const VENUE_LABEL: Record<Venue, string> = { home: "Home", away: "Away", neutral: "Neutral" };

/** "vs Opal", "at Opal", or "vs Opal (neutral)"; empty with no opponent. */
export function versus(opponent: string, venue: Venue): string {
  if (!opponent) return "";

  return venue === "away" ? `at ${opponent}` : venue === "neutral" ? `vs ${opponent} (neutral)` : `vs ${opponent}`;
}

/** A moment as a short day and time, e.g. "17 Oct, 18:30". */
export function formatWhen(iso: string): string {
  const d = new Date(iso);

  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
