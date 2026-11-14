import type { JSX } from "react";

import { Range } from "../../ui/Range";
import { formatTime } from "../exporters";
import type { Player } from "../usePlayer";

/** The seek bar, with a tick for each recorded event (coloured by who won it) and each pending mark. */
export function SeekBar({
  player,
  markers,
  marks,
}: {
  player: Player;
  markers: readonly { time: number; tone: "us" | "them" | null }[];
  marks: readonly number[];
}): JSX.Element {
  const at = (t: number) => ({ left: `${(t / player.duration) * 100}%` });

  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-right text-xs tabular-nums">{formatTime(player.currentTime)}</span>
      <div className="relative flex h-4 flex-1 items-center">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5">
          {player.duration > 0 &&
            markers.map((m, i) => (
              <span
                key={i}
                className={`absolute top-0 h-1.5 w-px ${m.tone === "us" ? "bg-accent" : m.tone === "them" ? "bg-danger" : "bg-text-dim"}`}
                style={at(m.time)}
              />
            ))}
          {player.duration > 0 &&
            marks.map((t, i) => (
              <span key={`mark-${i}`} className="absolute -top-1 h-3 w-0.5 rounded-xs bg-text" style={at(t)} />
            ))}
        </div>
        <Range
          aria-label="Seek"
          min={0}
          max={player.duration || 0}
          step={0.1}
          value={player.currentTime}
          onChange={(e) => player.seek(parseFloat(e.target.value))}
        />
      </div>
      <span className="w-14 text-xs tabular-nums">{formatTime(player.duration)}</span>
    </div>
  );
}
