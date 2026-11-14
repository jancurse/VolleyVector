import type { JSX } from "react";

import { Select } from "../../ui/Select";
import { cx, DANGER_TINT, THEM_RULE, US_RULE } from "../../ui/styles";
import { POINT_REASONS } from "../codes";
import type { Rally } from "../types";

/** A rally whose winner was inferred from who served next, with an optional reason to record. */
export function InferredEnd({
  rally,
  onAnnotate,
}: {
  rally: Rally & { winner: "us" | "them" };
  onAnnotate: (reason: string) => void;
}): JSX.Element {
  const { winner } = rally;
  // We always touch our own serve, so a rally we served with no touches means a missed tag.
  const missingServe = rally.touches.length === 0 && rally.serving === "us";

  return (
    <div
      className={cx(
        "flex items-center gap-2 border-l-4 py-1 pr-2 pl-3 text-xs",
        winner === "us" ? US_RULE : THEM_RULE,
        missingServe && DANGER_TINT
      )}
    >
      <span className="w-12" />
      <span className="flex-1 truncate italic text-text-dim">
        {missingServe
          ? "We were serving but no serve is recorded. Check the video."
          : rally.touches.length === 0
            ? `${winner === "us" ? "Won" : "Lost"} a rally none of our players touched (from who served next)`
            : `${winner === "us" ? "Won" : "Lost"}, inferred from who served next`}
      </span>
      <Select
        variant="quiet"
        ariaLabel="Why the rally ended"
        value=""
        onValueChange={(v) => v && onAnnotate(v)}
        options={[{ value: "", label: "Why?" }, ...POINT_REASONS[winner].map((r) => ({ value: r.id, label: r.label }))]}
      />
    </div>
  );
}
