import type { JSX } from "react";

import { cx, THEM_TEXT, US_TEXT } from "../../ui/styles";
import type { Team } from "../types";

/** One side's score, with a dot while that side serves. */
export function TeamScore({
  side,
  name,
  score,
  serving,
}: {
  side: Team;
  name: string;
  score: number;
  serving: boolean;
}): JSX.Element {
  return (
    <div className="p-3 text-center">
      <div className="flex items-center justify-center gap-1 truncate text-xs font-semibold text-text-dim">
        {serving && <span className="inline-block size-2 rounded-full bg-text" title="Serving" />}
        {name}
      </div>
      <div className={cx("font-display text-score font-bold tabular-nums", side === "us" ? US_TEXT : THEM_TEXT)}>
        {score}
      </div>
    </div>
  );
}
