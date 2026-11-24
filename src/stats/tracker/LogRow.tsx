import type { JSX, ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { IconButton } from "../../ui/IconButton";
import { cx } from "../../ui/styles";
import { formatTime } from "../exporters";
import { LOCKED_HINT } from "./locked";

/**
 * One row of the log, whatever it holds. Clicking it jumps the video to its moment and picks it. The pencil, a double
 * click or Enter opens it in the entry.
 */
export function LogRow({
  time,
  current,
  locked,
  rule,
  open,
  remove,
  aside,
  className,
  onPick,
  onOpen,
  onDelete,
  children,
}: {
  time: number;
  /** The row open in the entry, or picked. */
  current: boolean;
  /** A locked set: the row can be jumped to, not changed. */
  locked: boolean;
  /** The classes of the rule down the row's left edge. */
  rule: string;
  /** What the pencil and the bin are called for this row. */
  open: string;
  remove: string;
  /** A control of the row's own, before the pencil and the bin. */
  aside?: ReactNode;
  className?: string;
  onPick: () => void;
  /** Absent for a row that holds nothing to change: it then has no pencil and no bin. */
  onOpen?: () => void;
  onDelete?: () => void;
  /** What the row says, after its time. */
  children: ReactNode;
}): JSX.Element {
  return (
    <div
      data-current={current || undefined}
      className={cx(
        "group relative flex items-center gap-3 border-l-4 py-1 pr-2 pl-3 hover:bg-control-hover",
        rule,
        current && "bg-accent-weak",
        className
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left"
        title="Jump to this moment"
        aria-current={current || undefined}
        onClick={onPick}
        onDoubleClick={locked ? undefined : onOpen}
      >
        <span className="w-14 flex-none px-2 text-sm font-semibold text-text-dim tabular-nums">{formatTime(time)}</span>
        {children}
      </button>
      {aside}
      {onDelete && (
        <div
          className={cx(
            "flex items-center",
            // The pencil and the bin take no room from the row's text: they lie over its end, and show on hover.
            !current &&
              "absolute inset-y-0 right-1 rounded-md bg-control-hover opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:static pointer-coarse:bg-transparent pointer-coarse:opacity-100"
          )}
        >
          {onOpen && (
            <IconButton
              variant="plain"
              size="sm"
              aria-label={open}
              tooltip={locked ? LOCKED_HINT : `${open} (Enter)`}
              disabled={locked}
              onClick={onOpen}
            >
              <Pencil size={14} aria-hidden="true" />
            </IconButton>
          )}
          <IconButton
            variant="plain"
            size="sm"
            aria-label={remove}
            tooltip={locked ? LOCKED_HINT : undefined}
            disabled={locked}
            onClick={onDelete}
          >
            <Trash2 size={14} aria-hidden="true" />
          </IconButton>
        </div>
      )}
    </div>
  );
}
