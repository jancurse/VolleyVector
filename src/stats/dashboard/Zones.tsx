import type { JSX } from "react";

import { cx, DASH_ZONE } from "../../ui/styles";
import { skillDef } from "../codes";
import type { Skill } from "../types";
import { ALL } from "./data";
import type { GradeCount } from "./data";
import { byGrade, pct } from "./format";
import { gradeClass, gradeKey } from "./grades";
import { Legend } from "./Legend";
import { NetLabel } from "./NetLabel";
import { TipBox } from "./TipBox";

const ZONES = ["4", "3", "2", "7", "8", "9", "5", "6", "1", "0"];

/** One action by court zone: the shade counts touches, the bar shows their outcomes; a tap opens the clips. */
export function Zones({
  grades,
  skill,
  set,
  player,
}: {
  grades: readonly GradeCount[];
  skill: Skill;
  set: string;
  player: string;
}): JSX.Element {
  const order = grades.filter((r) => r.zone === ALL).sort(byGrade);
  const total = order.reduce((a, r) => a + r.n, 0);
  const byZone = new Map<string, GradeCount[]>();

  for (const r of grades) if (r.zone !== ALL) byZone.set(r.zone, [...(byZone.get(r.zone) ?? []), r]);

  const zoneN = (g: readonly GradeCount[]) => g.reduce((a, r) => a + r.n, 0);
  const max = Math.max(1, ...[...byZone.values()].map(zoneN));
  const label = skillDef(skill).label;

  return (
    <TipBox className="grid max-w-dash-court grid-cols-3 gap-0.75">
      {(tip) => (
        <>
          <Legend className="col-span-full mb-1" items={gradeKey(order)} />
          <NetLabel />
          {ZONES.map((z) => {
            const g = byZone.get(z);
            const n = g ? zoneN(g) : 0;
            const counts = new Map(g?.map((r) => [r.grade, r.n]));
            const out = z === "0";

            return (
              <div
                key={z}
                className={cx(
                  DASH_ZONE,
                  out ? "col-span-full mt-2 gap-2 p-2" : "aspect-square flex-col justify-center",
                  g ? "cursor-pointer" : "border-dashed opacity-50"
                )}
                {...(g
                  ? tip({
                      lines: [
                        `${label}, zone ${z}`,
                        `${n} of ${total} (${pct(n / total)})`,
                        ...order.filter((o) => counts.get(o.grade)).map((o) => `${o.grade} ${counts.get(o.grade)}`),
                      ],
                      clips: { set, player, action: skill, zone: z },
                    })
                  : {})}
              >
                <span className={cx("text-text-dim", out ? "relative" : "absolute top-0.5 left-1")}>
                  {out ? "Zone 0" : z}
                </span>
                {g && (
                  <>
                    <i className="absolute inset-0 bg-text-dim" style={{ opacity: 0.05 + (0.2 * n) / max }} />
                    <b className="relative font-display text-lg font-bold">{n}</b>
                    <span
                      className={cx(
                        "relative flex h-2 gap-px overflow-hidden rounded-xs",
                        out ? "w-2/5" : "mt-1 w-4/5"
                      )}
                    >
                      {order.map((o, i) =>
                        counts.get(o.grade) ? (
                          <span
                            key={o.grade}
                            className={cx("block", gradeClass(order, i))}
                            style={{ flex: `${counts.get(o.grade)} 0 0` }}
                          />
                        ) : null
                      )}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </>
      )}
    </TipBox>
  );
}
