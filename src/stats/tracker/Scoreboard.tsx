import type { JSX } from "react";

import { Button } from "../../ui/Button";
import { CALLOUT_WARN, cx, PANEL_PAD_X, POINT_BUTTON, THEM_TINT, US_TINT } from "../../ui/styles";
import { POINT_REASONS } from "../codes";
import type { Rally, Team } from "../types";
import { Kbd } from "./Kbd";
import { LOCKED_HINT } from "./locked";
import { TeamScore } from "./TeamScore";

type ScoreboardProps = {
  rally: Rally;
  /** How many rallies known from the draft alone the rally's score counts. */
  unconfirmed: number;
  /** Our name and the opponent's, as the scoreboard labels them. */
  names: { us: string; them: string };
  /** A just-recorded manual point still waiting for an (optional) reason. */
  pending: { id: number; winner: Team } | null;
  notice: string | null;
  /** A locked set: no points can be given. */
  locked: boolean;
  onPoint: (winner: Team) => void;
  onReason: (reason: string) => void;
};

const POINT_HINT = {
  us: "Point to us that none of our touches decided: an opponent error, or the set’s last rally",
  them: "Point to the opponent that none of our touches decided: an untouched kill or ace",
};

/** The live score, serve, and rotation on one row, with the two manual points; a point then asks why. */
export function Scoreboard({
  rally,
  unconfirmed,
  names,
  pending,
  notice,
  locked,
  onPoint,
  onReason,
}: ScoreboardProps): JSX.Element {
  return (
    <section className={cx("flex flex-col gap-2", PANEL_PAD_X)} aria-label="Scoreboard">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <TeamScore side="us" name={names.us} score={rally.score.us} serving={rally.serving === "us"} />
        <span className="text-text-dim">:</span>
        <TeamScore side="them" name={names.them} score={rally.score.them} serving={rally.serving === "them"} />
        <span
          className="text-xs whitespace-nowrap text-text-dim"
          title={`Rotation ${rally.rotation}, rally ${rally.index}`}
        >
          R<b className="text-text">{rally.rotation}</b> · rally {rally.index}
        </span>
        {unconfirmed > 0 && (
          <span
            className="text-xs whitespace-nowrap text-text-dim"
            title="The score counts the rallies the draft knows and you have not recorded: who serves a rally tells who won the one before"
          >
            with {unconfirmed} {unconfirmed === 1 ? "rally" : "rallies"} not recorded yet
          </span>
        )}
        <span className="flex-1" />
        <span className="flex flex-none gap-2">
          {(["us", "them"] as const).map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => onPoint(side)}
              disabled={locked}
              aria-label={`Point ${names[side]}`}
              title={locked ? LOCKED_HINT : POINT_HINT[side]}
              className={cx(POINT_BUTTON, "px-3", side === "us" ? US_TINT : THEM_TINT)}
            >
              Point <Kbd>{side === "us" ? "+" : "-"}</Kbd>
            </button>
          ))}
        </span>
      </div>
      {pending && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-text-dim">Why? (optional, Esc to skip)</span>
          {POINT_REASONS[pending.winner].map((r, i) => (
            <Button key={r.id} variant="ghost" size="sm" onClick={() => onReason(r.id)}>
              {r.label} <Kbd>{i + 1}</Kbd>
            </Button>
          ))}
        </div>
      )}
      {notice && <p className={CALLOUT_WARN}>{notice}</p>}
    </section>
  );
}
