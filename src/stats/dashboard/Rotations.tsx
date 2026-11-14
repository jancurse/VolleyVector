import type { JSX } from "react";

import { cx, DASH_ZONE, MUTED } from "../../ui/styles";
import type { rotationStats } from "./data";
import { pct } from "./format";
import { NetLabel } from "./NetLabel";
import { TipBox } from "./TipBox";

type RotationRow = ReturnType<typeof rotationStats>[number];

const SIDES = [
  ["receive", "Side-out"],
  ["serve", "Break point"],
] as const;

/** How often each rotation won its rallies, receiving and serving, laid out as the court under the net. */
export function Rotations({ rows }: { rows: readonly RotationRow[] }): JSX.Element {
  if (!rows.length) return <p className={MUTED}>No rallies.</p>;

  const byRot = new Map(rows.map((r) => [r.rotation, r]));
  const won = (r: RotationRow, k: (typeof SIDES)[number][0]) => (k === "serve" ? r.serveWon : r.receiveWon);

  return (
    <TipBox className="grid max-w-dash-rotations grid-cols-[repeat(auto-fit,minmax(min(100%,var(--container-dash-rotation)),1fr))] gap-4">
      {(tip) =>
        SIDES.map(([k, name]) => {
          const tn = rows.reduce((a, r) => a + r[k], 0);
          const tw = rows.reduce((a, r) => a + won(r, k), 0);

          return (
            <div key={k}>
              <p className="m-0 mb-1 text-xs font-semibold">
                {name}
                <span className="ml-2 font-normal text-text-dim">{tn ? `${pct(tw / tn)} (${tw} of ${tn})` : ""}</span>
              </p>
              <div className="grid grid-cols-3 gap-0.75">
                <NetLabel />
                {[4, 3, 2, 5, 6, 1].map((rot) => {
                  const r = byRot.get(rot);
                  const n = r?.[k] ?? 0;
                  const w = r ? won(r, k) : 0;
                  const p = n ? w / n : 0;
                  // Shaded towards our colour above half won, towards the danger colour below.
                  const mix = Math.round(Math.abs(p - 0.5) * 2 * 45);

                  return (
                    <div
                      key={rot}
                      className={cx(
                        DASH_ZONE,
                        "aspect-square cursor-pointer flex-col justify-between px-1 pt-0.5 pb-1",
                        !n && "border-dashed opacity-50"
                      )}
                      style={
                        n
                          ? {
                              background: `color-mix(in srgb, ${p >= 0.5 ? "var(--accent)" : "var(--danger)"} ${mix}%, var(--panel))`,
                            }
                          : undefined
                      }
                      {...tip({
                        lines: [
                          `R${rot}, ${name}${r ? ` (setter ${r.setter} in ${rot})` : ""}`,
                          n ? `${w} of ${n} won (${pct(w / n)})` : "No rallies",
                        ],
                      })}
                    >
                      <span className="self-start text-2xs leading-none">R{rot}</span>
                      {n > 0 && (
                        <>
                          <b className="font-display text-sm font-bold leading-none tabular-nums">{pct(p)}</b>
                          <span>
                            {w}/{n}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      }
    </TipBox>
  );
}
