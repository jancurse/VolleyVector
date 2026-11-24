import type { JSX } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "../../ui/Button";
import { cx } from "../../ui/styles";
import type { ModelProgress } from "../draftModel";

type AiProgressProps = {
  /** Finding the rallies, which cannot be counted, or how many rallies have been read. */
  run: ModelProgress | "rallies";
  onStop: () => void;
};

/** A strip under the tracker's bar while a model drafts the set: what it is doing, how far it is, and Stop. */
export function AiProgress({ run, onStop }: AiProgressProps): JSX.Element {
  const counting = run !== "rallies";

  return (
    <div
      className="flex flex-none flex-wrap items-center gap-3 rounded-md border border-border bg-panel px-3 py-2 text-sm text-text"
      role="status"
    >
      <Sparkles size={16} className="flex-none text-accent" aria-hidden="true" />
      <span>
        {counting
          ? `AI is reading rally ${Math.min(run.done + 1, run.total)} of ${run.total}`
          : "AI is finding the rallies. This takes a few minutes."}
      </span>
      <div className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-pill bg-control">
        <div
          className={cx(
            "h-full rounded-pill bg-accent transition-[width] duration-300 ease-settle",
            !counting && "w-full animate-pulse"
          )}
          style={counting ? { width: `${(run.done / Math.max(run.total, 1)) * 100}%` } : undefined}
        />
      </div>
      <Button variant="ghost" size="sm" onClick={onStop}>
        Stop
      </Button>
    </div>
  );
}
