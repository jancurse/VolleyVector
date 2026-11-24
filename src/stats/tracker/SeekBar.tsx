import type { JSX } from "react";

import { Range } from "../../ui/Range";
import { formatTime } from "../exporters";

type SeekBarProps = {
  /** The playhead, and the stretch of the video the bar covers: all of it, or one clip. */
  time: number;
  start?: number;
  end: number;
  onSeek: (t: number) => void;
  markers: readonly { time: number; tone: "us" | "them" | null }[];
  marks?: readonly { time: number; model?: boolean }[];
};

/**
 * The seek bar, with a tick for each recorded event (coloured by who won it) and each pending contact: the recorder's
 * own marks in the text colour, a model's in the accent.
 */
export function SeekBar({ time, start = 0, end, onSeek, markers, marks = [] }: SeekBarProps): JSX.Element {
  const length = end - start;
  const at = (t: number) => ({ left: `${((t - start) / length) * 100}%` });

  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-right text-xs tabular-nums">
        {formatTime(Math.min(length, Math.max(0, time - start)))}
      </span>
      <div className="relative flex h-4 flex-1 items-center">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5">
          {length > 0 &&
            markers.map((m, i) => (
              <span
                key={i}
                className={`absolute top-0 h-1.5 w-px ${m.tone === "us" ? "bg-accent" : m.tone === "them" ? "bg-danger" : "bg-text-dim"}`}
                style={at(m.time)}
              />
            ))}
          {length > 0 &&
            marks.map((m, i) => (
              <span
                key={`mark-${i}`}
                className={`absolute -top-1 h-3 w-0.5 rounded-xs ${m.model ? "bg-accent" : "bg-text"}`}
                style={at(m.time)}
              />
            ))}
        </div>
        <Range
          aria-label="Seek"
          min={start}
          max={end || 0}
          step={0.1}
          value={Math.min(Math.max(time, start), end || 0)}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
        />
      </div>
      <span className="w-14 text-xs tabular-nums">{formatTime(length)}</span>
    </div>
  );
}
