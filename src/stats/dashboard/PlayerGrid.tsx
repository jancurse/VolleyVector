import type { JSX } from "react";

import { cx, DASH_ROW_PICK, DATA_HEAD_TYPE, MUTED } from "../../ui/styles";
import { actionLabel, ALL } from "./data";
import type { plusMinus, SkillSummary } from "./data";
import { pct, score, signed } from "./format";
import { HeatCell } from "./HeatCell";
import { ORDER } from "./params";
import { TipBox } from "./TipBox";

const HEAD = cx("px-2 py-1 print:px-1 print:py-0.5", DATA_HEAD_TYPE);

/** Every player's +/− and net per action; picking a player filters the metrics and zones to them. */
export function PlayerGrid({
  summary,
  pm,
  set,
  player,
  onPlayer,
}: {
  summary: readonly SkillSummary[];
  pm: ReturnType<typeof plusMinus>;
  set: string;
  player: string;
  onPlayer: (p: string) => void;
}): JSX.Element {
  const rows = summary.filter((r) => r.set === set && r.player !== ALL);

  if (!rows.length) return <p className={MUTED}>No touches.</p>;

  const skills = ORDER.filter((s) => rows.some((r) => r.skill === s));
  const attempts = new Map<string, number>();

  for (const r of rows) attempts.set(r.player, (attempts.get(r.player) ?? 0) + r.attempts);

  const players = [...attempts].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const byKey = new Map(rows.map((r) => [`${r.player}|${r.skill}`, r]));
  const pmBy = new Map(pm.filter((r) => r.set === set).map((r) => [r.player, r]));
  const pmMax = Math.max(1, ...[...pmBy.values()].map((r) => Math.abs(r.plusMinus)));
  const netMax = new Map(
    skills.map((s) => [s, Math.max(1, ...rows.filter((r) => r.skill === s).map((r) => Math.abs(r.net)))])
  );

  return (
    <TipBox className="overflow-x-auto print:overflow-visible">
      {(tip) => (
        <div
          className="grid gap-0.5 text-xs print:text-2xs"
          style={{
            gridTemplateColumns: `max-content repeat(${skills.length + 1}, minmax(var(--container-dash-col), 1fr))`,
          }}
        >
          <div className={HEAD}>Player</div>
          <div className={HEAD}>+/−</div>
          {skills.map((s) => (
            <div key={s} className={HEAD}>
              {actionLabel(s)}
            </div>
          ))}
          {players.map((name) => {
            const pr = pmBy.get(name);

            return (
              <div key={name} className="contents">
                <button
                  type="button"
                  aria-pressed={name === player}
                  onClick={() => onPlayer(name === player ? ALL : name)}
                  className={DASH_ROW_PICK}
                >
                  {name}
                </button>
                {pr?.rallies ? (
                  <HeatCell
                    value={pr.plusMinus}
                    max={pmMax}
                    tip={tip}
                    content={{
                      lines: [
                        `${name}, +/−`,
                        `${pr.won} won − ${pr.rallies - pr.won} lost = ${signed(pr.plusMinus)}`,
                        `${pct(pr.wonRate)} of ${pr.rallies} rallies on court won`,
                      ],
                    }}
                  >
                    {signed(pr.plusMinus)} ({pct(pr.wonRate)})
                  </HeatCell>
                ) : (
                  <div />
                )}
                {skills.map((s) => {
                  const r = byKey.get(`${name}|${s}`);

                  if (!r) return <div key={s} />;

                  const pos = r.def?.posName.toLowerCase() ?? "positive";

                  return (
                    <HeatCell
                      key={s}
                      value={r.net}
                      max={netMax.get(s) ?? 1}
                      tip={tip}
                      content={{
                        lines: [
                          `${name}, ${actionLabel(s)}`,
                          `${r.pos} ${pos}, ${r.errors} errors, ${r.attempts} attempts`,
                          `Net ${signed(r.net)} (${pos} − errors)`,
                          ...(r.def ? [`${r.def.name} ${score(r)} = ${r.def.formula}`] : []),
                        ],
                        clips: { set, player: name, action: s },
                      }}
                    >
                      {signed(r.net)} ({score(r)})
                    </HeatCell>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </TipBox>
  );
}
