import type { JSX } from "react";

import { Select } from "../../ui/Select";
import { cx, DANGER_TINT, THEM_TEXT, US_TEXT } from "../../ui/styles";
import { POINT_REASONS, pointReasonLabel } from "../codes";
import type { Rally } from "../types";
import { LogRow } from "./LogRow";

/**
 * Where a rally ends, with its result. A point recorded by hand is this row: it shows the point's reason and opens
 * and deletes it. A result nothing recorded decides is worked out from who served next: the row says so, and takes
 * the reason, which records it as a point.
 */
export function RallyEnd({
  rally,
  end,
  settled,
  outline,
  locked,
  current,
  onPick,
  onOpen,
  onDelete,
  onAnnotate,
}: {
  rally: Rally & { winner: "us" | "them" };
  /** When the rally ends in the video. */
  end: number;
  /** Whether the result rests on recorded events alone. */
  settled: boolean;
  /** Whether nothing of the rally is recorded yet. */
  outline: boolean;
  locked: boolean;
  /** Whether the rally's point is the row open in the entry, or picked. */
  current: boolean;
  onPick: () => void;
  /** Open or delete the rally's point; absent when no point was recorded by hand. */
  onOpen?: () => void;
  onDelete?: () => void;
  onAnnotate: (reason: string) => void;
}): JSX.Element {
  const { winner, endedBy } = rally;
  // We always touch our own serve, so a rally we served with no touches means a missed tag.
  const missingServe = rally.touches.length === 0 && rally.serving === "us";
  const note = !settled
    ? "by a rally not recorded yet"
    : endedBy?.kind === "point"
      ? endedBy.reason
        ? pointReasonLabel(winner, endedBy.reason)
        : "no reason"
      : missingServe
        ? "We were serving but no serve is recorded. Check the video."
        : !rally.inferred
          ? ""
          : rally.touches.length === 0
            ? "a rally none of our players touched, from who served next"
            : "from who served next";

  return (
    <LogRow
      time={end}
      current={current}
      locked={locked}
      rule="border-l-transparent"
      className={cx("mt-1 border-t border-t-border", missingServe && settled && rally.inferred && DANGER_TINT)}
      open="Edit"
      remove="Delete"
      onPick={onPick}
      onOpen={onOpen}
      onDelete={onDelete}
      aside={
        rally.inferred &&
        settled &&
        !outline &&
        !locked && (
          <Select
            variant="quiet"
            ariaLabel="Why the rally ended"
            value=""
            onValueChange={(v) => v && onAnnotate(v)}
            options={[
              { value: "", label: "Why?" },
              ...POINT_REASONS[winner].map((r) => ({ value: r.id, label: r.label })),
            ]}
          />
        )
      }
    >
      <span className="text-sm text-text-dim">End</span>
      <span className={cx("text-sm", winner === "us" ? US_TEXT : THEM_TEXT, settled ? "font-semibold" : "italic")}>
        {winner === "us" ? "Won" : "Lost"}
        {!settled && "?"} · {rally.score.us}–{rally.score.them}
      </span>
      {note && <span className="truncate text-xs text-text-dim italic">{note}</span>}
    </LogRow>
  );
}
