import type { JSX } from "react";

import { cx, DASH_FIGURE, MUTED } from "../../ui/styles";
import type { momentum } from "./data";
import { eff, pct } from "./format";
import { TipBox } from "./TipBox";

/**
 * Momentum: how often we won the next rally after a run of won or lost rallies, against the set's or the
 * match's average, and the overall effect with its 95% interval.
 */
export function Momentum({
  mom,
  set,
  mbase,
}: {
  mom: ReturnType<typeof momentum>;
  set: string;
  mbase: "set" | "match";
}): JSX.Element {
  const runs = mom.runs.filter((r) => r.set === set);
  const r = mom.models.find((m) => m.set === set && m.baseline === mbase);
  const z = (v: number | null) => (v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1));
  const x = (v: number) => `${50 + 100 * Math.max(-0.5, Math.min(0.5, v))}%`;
  const tone = r && r.p < 0.05 ? (r.corrected > 0 ? "bg-chart-us" : "bg-chart-bad") : "bg-chart-axis";

  return (
    <>
      <TipBox className="grid grid-cols-[max-content_minmax(0,1fr)_max-content] items-center gap-x-2 gap-y-1.5 text-xs">
        {(tip) =>
          runs.length ? (
            runs.map((run) => {
              const label = `${Math.abs(run.run) === 3 ? "3+" : Math.abs(run.run)} ${run.run > 0 ? "won" : "lost"}`;
              const exp = mbase === "set" ? run.expSet : run.expMatch;
              const lines = [
                `After ${label} (${run.side})`,
                `Won ${run.won} of ${run.n} (${pct(run.won / run.n)})`,
                `${mbase === "set" ? "Set" : "Match"} average ${pct(exp)}`,
                `z ${z(mbase === "set" ? run.zSet : run.zMatch)}`,
              ];

              return (
                <div key={run.run} className="contents">
                  <span>{label}</span>
                  <div className="relative h-4 cursor-pointer rounded-xs bg-chart-grid" {...tip({ lines })}>
                    <b
                      className="absolute inset-y-0 left-0 rounded-xs bg-chart-us"
                      style={{ width: pct(run.won / run.n) }}
                    />
                    <i className="absolute -inset-y-0.75 -ml-px w-0.5 bg-text" style={{ left: pct(exp) }} />
                  </div>
                  <span className="text-right text-text-dim">
                    {run.won}/{run.n}
                  </span>
                </div>
              );
            })
          ) : (
            <p className={MUTED}>Not enough rallies.</p>
          )
        }
      </TipBox>
      <TipBox className="grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs">
        {(tip) => {
          if (!r) return null;

          const t = tip({
            lines: [
              "Momentum effect",
              `Win probability, hot against cold run: ${eff(r.corrected)}`,
              `95% interval ${eff(r.corrected - r.ci)} to ${eff(r.corrected + r.ci)}`,
              `p = ${r.p.toFixed(2)}, ${r.n} rallies`,
            ],
          });

          return (
            <>
              <b className={cx(DASH_FIGURE, "cursor-pointer")} {...t}>
                {eff(r.corrected)}
              </b>
              <div className="relative row-span-2 h-5.5 cursor-pointer" {...t}>
                <i className="absolute inset-x-0 top-1/2 h-px bg-chart-grid" />
                <i className="absolute inset-y-0 left-1/2 w-px bg-chart-axis" />
                <i
                  className={cx("absolute top-1/2 h-1.5 -translate-y-1/2 rounded-pill opacity-45", tone)}
                  style={{
                    left: x(r.corrected - r.ci),
                    width: `calc(${x(r.corrected + r.ci)} - ${x(r.corrected - r.ci)})`,
                  }}
                />
                <i
                  className={cx("absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full", tone)}
                  style={{ left: x(r.corrected) }}
                />
              </div>
              <span className="cursor-pointer text-text-dim underline decoration-dotted" {...t}>
                Momentum effect
                {Math.abs(r.corrected) > 0.5 && " (beyond the scale)"}
              </span>
              <div className="col-start-2 flex justify-between text-text-dim">
                <span>−50%</span>
                <span>0</span>
                <span>+50%</span>
              </div>
            </>
          );
        }}
      </TipBox>
    </>
  );
}
