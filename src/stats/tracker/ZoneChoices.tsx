import type { JSX } from "react";

import { NET_CAPTION, NET_LINE } from "../../ui/styles";
import { ZONE_GRID } from "../codes";
import { Choice } from "./Choice";

/** The zone step: the court's zones under the net, error (0) at the left of the back row. */
export function ZoneChoices({
  zone,
  live,
  onPick,
}: {
  zone: string;
  live: boolean;
  onPick: (zone: string) => void;
}): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-xs">
      <div className={NET_CAPTION}>net</div>
      <div className={`${NET_LINE} flex flex-col gap-1.5`}>
        {ZONE_GRID.map((row, r) => (
          <div key={r} className="grid grid-cols-4 gap-1.5">
            {row.map((z, c) =>
              z ? (
                <Choice key={c} selected={zone === z} hotkey={z} hotkeyDim={!live} onClick={() => onPick(z)}>
                  {z === "0" ? "Err" : `Z${z}`}
                </Choice>
              ) : (
                <div key={c} />
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
