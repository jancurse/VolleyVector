import type { JSX } from "react";

import { cx, DASH_ROWS, MUTED, SWATCH } from "../../ui/styles";
import type { plusMinus } from "./data";
import { Legend } from "./Legend";
import { TipBox } from "./TipBox";

const HEAD = "text-text-dim";

/** Rallies each player spent on court, against those they were in the lineup for. */
export function PlayingTime({ rows: unsorted }: { rows: ReturnType<typeof plusMinus> }): JSX.Element {
  const rows = [...unsorted].sort((a, b) => b.lineup - a.lineup || b.rallies - a.rallies);

  if (!rows.length) return <p className={MUTED}>No lineup recorded.</p>;

  const max = Math.max(1, ...rows.map((r) => r.lineup));

  return (
    <TipBox className={DASH_ROWS}>
      {(tip) => (
        <>
          <Legend
            className="col-span-full"
            items={[
              { swatch: cx(SWATCH, "bg-chart-us"), label: "On court" },
              { swatch: cx(SWATCH, "bg-chart-us opacity-30"), label: "In lineup" },
            ]}
          />
          <div className={HEAD}>Player</div>
          <div className={HEAD} />
          <div className={cx(HEAD, "text-right")}>Rallies</div>
          <div className={cx(HEAD, "text-right")}>Sets</div>
          {rows.map((r) => {
            const t = tip({
              lines: [
                r.player,
                `On court ${r.rallies} rallies`,
                `In lineup ${r.lineup} rallies`,
                `${r.setsPlayed.toFixed(1)} sets`,
              ],
            });

            return (
              <div key={r.player} className="contents">
                <div {...t}>{r.player}</div>
                <div className="relative h-4.5" {...t}>
                  <i
                    className="absolute inset-y-0 left-0 rounded-xs bg-chart-us opacity-30"
                    style={{ width: `${(100 * r.lineup) / max}%` }}
                  />
                  <i
                    className="absolute inset-y-0 left-0 rounded-xs bg-chart-us"
                    style={{ width: `${(100 * r.rallies) / max}%` }}
                  />
                </div>
                <div className="text-right" {...t}>
                  {r.rallies === r.lineup ? r.rallies : `${r.rallies}/${r.lineup}`}
                </div>
                <div className="text-right" {...t}>
                  {r.setsPlayed.toFixed(1)}
                </div>
              </div>
            );
          })}
        </>
      )}
    </TipBox>
  );
}
