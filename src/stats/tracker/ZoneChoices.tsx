import type { JSX } from "react";

import { cx, NET_CAPTION, NET_LINE, NET_LINE_BELOW } from "../../ui/styles";
import { ZONE_GRID, ZONE_GRID_THEIRS } from "../codes";
import { Choice } from "./Choice";

type ZoneChoicesProps = {
  zone: string;
  live: boolean;
  /** Whose court the zone is on: the opponent's is drawn from our side, with the net at the bottom. */
  side: "ours" | "theirs";
  /** What zone 0 means for this touch ("Err" or "N/A"). */
  zero: string;
  onPick: (zone: string) => void;
};

/** The zone step: a court's zones against the net, with zone 0 beside the back row. */
export function ZoneChoices({ zone, live, side, zero, onPick }: ZoneChoicesProps): JSX.Element {
  const theirs = side === "theirs";
  const net = <div className={NET_CAPTION}>net</div>;

  return (
    <div className="mx-auto w-full max-w-xs">
      {theirs ? <p className="m-0 mb-1.5 text-center text-xs text-text-dim">Their court, seen from ours</p> : net}
      <div className={cx("flex flex-col gap-1.5", theirs ? NET_LINE_BELOW : NET_LINE)}>
        {(theirs ? ZONE_GRID_THEIRS : ZONE_GRID).map((row, r) => (
          <div key={r} className="grid grid-cols-4 gap-1.5">
            {row.map((z, c) =>
              z ? (
                <Choice key={c} selected={zone === z} hotkey={z} hotkeyDim={!live} onClick={() => onPick(z)}>
                  {z === "0" ? zero : `Z${z}`}
                </Choice>
              ) : (
                <div key={c} />
              )
            )}
          </div>
        ))}
      </div>
      {theirs && net}
    </div>
  );
}
