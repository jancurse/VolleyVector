import type { JSX, ReactNode } from "react";
import { Volleyball } from "lucide-react";

import { cx } from "../ui/styles";
import { COURT_ORDER, ROMAN } from "./rotation";

// The slip's court sketch: the net as a double rule, then the six zones in reading order from behind our
// end line (front row IV-III-II, shaded, back row V-VI-I). Each zone carries its official position and,
// at I, the server's ball; `zone` fills the rest.
export function SlipCourt({ zone }: { zone: (index: number) => ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col">
      <div className="border-t-4 border-double border-text" aria-hidden="true" />
      <div className="grid grid-cols-3 border-x-2 border-b-2 border-text">
        {COURT_ORDER.map((index, i) => (
          <div
            key={index}
            className={cx(
              "relative grid min-h-24 border-text/25",
              i < 3 && "bg-[var(--court-zone)]",
              i % 3 !== 2 && "border-r",
              i >= 3 && "border-t border-dashed border-t-text/60"
            )}
          >
            <span className="pointer-events-none absolute top-1 left-1.5 z-10 flex items-center gap-1 font-mono text-2xs font-bold text-text-dim">
              {ROMAN[index]}
              {index === 0 && <Volleyball size={11} aria-label="Serves" />}
            </span>
            {zone(index)}
          </div>
        ))}
      </div>
    </div>
  );
}
