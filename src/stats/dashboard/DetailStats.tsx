import type { JSX } from "react";

import { DASH_NOTE } from "../../ui/styles";
import type { DetailGroup } from "./data";

/** The numbers only detailed stats give, each group with how many of its touches carry the detail. */
export function DetailStats({ groups }: { groups: readonly DetailGroup[] }): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <section key={g.title} aria-label={g.title} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="m-0 text-sm font-semibold">{g.title}</h4>
            <span className={DASH_NOTE}>
              from {g.covered} of {g.total} {g.noun}
            </span>
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 gap-y-1 text-xs">
            {g.rows.map((r) => (
              <div key={r.label} className="contents">
                <span>{r.label}</span>
                <span className="text-right text-text-dim tabular-nums">{r.n}</span>
                <span className="text-right">
                  <b className="tabular-nums">{r.figure}</b> <span className="text-text-dim">{r.name}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
