import type { JSX, ReactNode } from "react";
import { RotateCcw, RotateCw } from "lucide-react";

import { IconButton } from "../ui/IconButton";
import { cx } from "../ui/styles";

// The paper sheet every rotation slip shares: a caption and title, the version stamp (flanked by rotate
// buttons when `onRotate` is given, hidden in print), then the slip's body. A slip is always ink on white,
// so it pins the light theme for itself and reads the same on screen, in dark mode, and on paper. `compact`
// tightens the spacing so more slips fit a printed page.
type SlipFrameProps = {
  caption: string;
  title: string;
  stamp: string;
  ariaLabel: string;
  /** Rotate the slip: receives the shift to apply, 1 for back (I → II) and -1 for forward (II → I). */
  onRotate?: (steps: number) => void;
  compact?: boolean;
  children: ReactNode;
};

export function SlipFrame({
  caption,
  title,
  stamp,
  ariaLabel,
  onRotate,
  compact,
  children,
}: SlipFrameProps): JSX.Element {
  return (
    <article
      data-theme="light"
      className={cx(
        "flex w-full break-inside-avoid flex-col rounded-sm border-2 border-text bg-white text-text",
        compact ? "gap-2 p-2" : "gap-3 p-3"
      )}
      aria-label={ariaLabel}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="m-0 font-mono text-2xs font-bold tracking-[0.16em] text-text-dim uppercase">{caption}</p>
          <p className="m-0 font-display text-display-xs font-bold leading-tight break-words">{title}</p>
        </div>
        <div className="flex flex-none items-center gap-1">
          {onRotate && (
            <IconButton
              variant="plain"
              size="xs"
              className="print:hidden"
              aria-label="Rotate back (I → II)"
              onClick={() => onRotate(1)}
            >
              <RotateCcw size={13} aria-hidden="true" />
            </IconButton>
          )}
          <span className="flex-none -rotate-3 rounded-xs border-2 border-double border-accent px-1.5 py-0.5 text-center font-mono text-2xs font-bold leading-tight text-accent uppercase">
            {stamp}
          </span>
          {onRotate && (
            <IconButton
              variant="plain"
              size="xs"
              className="print:hidden"
              aria-label="Rotate forward (II → I)"
              onClick={() => onRotate(-1)}
            >
              <RotateCw size={13} aria-hidden="true" />
            </IconButton>
          )}
        </div>
      </header>
      {children}
    </article>
  );
}
