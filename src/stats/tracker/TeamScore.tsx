import type { JSX } from "react";

import { cx, THEM_TEXT, US_TEXT } from "../../ui/styles";
import type { Team } from "../types";

/** One side's name and score on the score row, with a dot while that side serves; the scores meet in the middle. */
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
    <span className={cx("flex min-w-0 items-baseline gap-1.5", side === "them" && "flex-row-reverse")}>
      {serving && <span className="inline-block size-2 flex-none self-center rounded-full bg-text" title="Serving" />}
      <span className="truncate text-xs font-semibold text-text-dim">{name}</span>
      <b className={cx("font-display text-xl leading-none tabular-nums", side === "us" ? US_TEXT : THEM_TEXT)}>
        {score}
      </b>
    </span>
  );
}
