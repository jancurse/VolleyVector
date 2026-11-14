import type { JSX } from "react";

import { cx, TAG_CHIP, THEM_TEXT, US_TEXT } from "../ui/styles";
import type { SetSummary } from "./types";

/** Sets won and lost, counting only sets with points in them. */
function matchResult(sets: readonly Pick<SetSummary, "us" | "them">[]): {
  won: number;
  lost: number;
  played: number;
} {
  const played = sets.filter((s) => s.us + s.them > 0);

  return {
    won: played.filter((s) => s.us > s.them).length,
    lost: played.filter((s) => s.them > s.us).length,
    played: played.length,
  };
}

/** A game's result in sets: "Won 3–1", "Lost 1–3", "Level 1–1", or that no points are recorded yet. */
export function ResultBadge({ sets }: { sets: readonly Pick<SetSummary, "us" | "them">[] }): JSX.Element {
  const { won, lost, played } = matchResult(sets);

  if (!played) return <span className="text-xs text-text-dim">No points yet</span>;

  return (
    // The colour sits on an inner span: TAG_CHIP sets its own text colour, which a class added beside it does not beat.
    <span className={cx(TAG_CHIP, "tabular-nums")}>
      <span className={won > lost ? US_TEXT : won < lost ? THEM_TEXT : undefined}>
        {won > lost ? "Won" : won < lost ? "Lost" : "Level"} {won}–{lost}
      </span>
    </span>
  );
}
