import type { JSX } from "react";

import { cx, DASH_FIGURE, DASH_TILE, THEM_TEXT, US_TEXT } from "../../ui/styles";
import { youtubeAt } from "../clips";
import type { RallyRow, SetInfo, setScores } from "./data";
import { ExternalLink } from "../../ui/ExternalLink";

/** Each set's score and result; the set's name opens its video at its first rally. */
export function SetTiles({
  scores,
  sets,
  rallies,
}: {
  scores: ReturnType<typeof setScores>;
  sets: readonly SetInfo[];
  rallies: readonly RallyRow[];
}): JSX.Element {
  const info = new Map(sets.map((s) => [s.id, s]));
  // Sets can share one match video, so a set's link starts at its first rally.
  const start = (set: string) => Math.min(...rallies.filter((r) => r.set === set).map((r) => r.start));

  return (
    <ul className="m-0 grid max-w-dash-tiles list-none grid-cols-[repeat(auto-fill,minmax(var(--container-dash-tile),1fr))] gap-2 p-0">
      {scores.map((s) => {
        const set = info.get(s.set);

        return (
          <li key={s.set} className={DASH_TILE}>
            <span className="text-xs text-text-dim">
              {set?.videoId ? (
                <ExternalLink
                  href={youtubeAt(set.videoId, start(s.set) - 3)}
                  title="Watch the set on YouTube"
                  tone="inherit"
                >
                  {set.label}
                </ExternalLink>
              ) : (
                set?.label
              )}
            </span>
            <span className={cx(DASH_FIGURE, "whitespace-nowrap")}>
              {s.us}–{s.them}
            </span>
            <span className={cx("text-xs", s.won ? US_TEXT : THEM_TEXT)}>{s.won ? "Won" : "Lost"}</span>
          </li>
        );
      })}
    </ul>
  );
}
