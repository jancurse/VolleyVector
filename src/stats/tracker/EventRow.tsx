import type { JSX } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "../../ui/Button";
import { IconButton } from "../../ui/IconButton";
import { cx, THEM_RULE, US_RULE } from "../../ui/styles";
import { pointReasonLabel, resultLabel, touchOutcome, touchReasonLabel } from "../codes";
import { formatTime } from "../exporters";
import type { MatchEvent } from "../types";

/** One recorded event in the log: its time (seeks the video), what happened, and edit and delete. */
export function EventRow({
  event: e,
  editing,
  onSeek,
  onEdit,
  onDelete,
}: {
  event: MatchEvent;
  editing: boolean;
  onSeek: () => void;
  onEdit: () => void;
  onDelete: () => void;
}): JSX.Element {
  const outcome = e.kind === "touch" ? touchOutcome(e) : e.kind === "point" ? e.winner : null;

  return (
    <div
      className={cx(
        "group flex items-center gap-3 border-l-4 py-1 pr-2 pl-3 hover:bg-control",
        outcome === "us" ? US_RULE : outcome === "them" ? THEM_RULE : "border-l-transparent",
        editing && "bg-accent-weak"
      )}
    >
      <Button
        variant="text"
        size="sm"
        className="w-14 justify-start tabular-nums"
        onClick={onSeek}
        title="Jump to this moment"
      >
        {formatTime(e.timestamp)}
      </Button>
      <div className="flex-1 truncate text-sm">
        {e.kind === "touch" ? (
          <>
            <b className="text-text">{e.player}</b> <span className="capitalize text-text-dim">{e.stat}</span>{" "}
            <span className="text-text">{resultLabel(e.stat, e.result)}</span>{" "}
            {e.reason && <span className="text-danger">({touchReasonLabel(e.stat, e.result, e.reason)})</span>}{" "}
            <span className="text-text-dim">z{e.zone}</span>
          </>
        ) : e.kind === "sub" ? (
          <span className="text-text-dim">
            <i>Sub</i> <b className="text-text">{e.in}</b> in for <b className="text-text">{e.out}</b>
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
      </div>
      <div className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
        {e.kind !== "sub" && (
          <IconButton variant="plain" size="sm" aria-label="Edit" onClick={onEdit}>
            <Pencil size={14} aria-hidden="true" />
          </IconButton>
        )}
        <IconButton variant="plain" size="sm" aria-label="Delete" onClick={onDelete}>
          <Trash2 size={14} aria-hidden="true" />
        </IconButton>
      </div>
    </div>
  );
}
