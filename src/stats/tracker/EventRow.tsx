import type { JSX } from "react";
import { Volleyball } from "lucide-react";

import { cx, THEM_RULE, THEM_TEXT, US_RULE, US_TEXT } from "../../ui/styles";
import { pointReasonLabel, resultLabel, skillLabel, touchOutcome, touchReasonLabel } from "../codes";
import type { MatchEvent } from "../types";
import { LogRow } from "./LogRow";

/**
 * One recorded event in the log, with a rule in the colour of the team it scored for. A serve carries a ball in its
 * team's colour, which is how a rally shows who served it.
 */
export function EventRow({
  event: e,
  opponent,
  current,
  locked,
  onPick,
  onOpen,
  onDelete,
}: {
  event: MatchEvent;
  /** The opponent's name, which is all their serve says. */
  opponent: string;
  current: boolean;
  locked: boolean;
  onPick: () => void;
  onOpen?: () => void;
  onDelete: () => void;
}): JSX.Element {
  const outcome = e.kind === "touch" ? touchOutcome(e) : e.kind === "point" ? e.winner : null;

  return (
    <LogRow
      time={e.timestamp}
      current={current}
      locked={locked}
      rule={outcome === "us" ? US_RULE : outcome === "them" ? THEM_RULE : "border-l-transparent"}
      open="Edit"
      remove="Delete"
      onPick={onPick}
      onOpen={onOpen}
      onDelete={onDelete}
    >
      <span className="flex-1 truncate text-sm">
        {e.kind === "touch" ? (
          <>
            {e.stat === "serve" && (
              <Volleyball size={12} className={cx("mr-1 inline align-[-1px]", US_TEXT)} aria-label="Our serve" />
            )}
            <b className="text-text">{e.player}</b> <span className="text-text-dim">{skillLabel(e)}</span>{" "}
            <span className="text-text">{resultLabel(e.stat, e.result)}</span>{" "}
            {e.reason && <span className="text-danger">({touchReasonLabel(e.stat, e.result, e.reason)})</span>}{" "}
            <span className="text-text-dim">z{e.zone}</span>
          </>
        ) : e.kind === "sub" ? (
          <span className="text-text-dim">
            <i>Sub</i> <b className="text-text">{e.in}</b> in for <b className="text-text">{e.out}</b>
          </span>
        ) : e.kind === "opponent" ? (
          <span className={cx("inline-flex items-center gap-1", THEM_TEXT)}>
            <Volleyball size={12} aria-label="Their serve" />
            {opponent || "Opponent"}
          </span>
        ) : (
          <span className="text-text-dim">
            <i>Point {e.winner === "us" ? "us" : "them"}</i>
            {e.reason ? (
              <b className="text-text"> · {pointReasonLabel(e.winner, e.reason)}</b>
            ) : (
              <span> · no reason</span>
            )}
          </span>
        )}
      </span>
    </LogRow>
  );
}
