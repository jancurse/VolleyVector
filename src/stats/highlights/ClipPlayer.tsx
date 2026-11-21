import { useEffect, useState } from "react";
import type { JSX } from "react";
import { Pause, Play, Repeat, RotateCcw, RotateCw, SkipBack, SkipForward } from "lucide-react";

import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { IconButton } from "../../ui/IconButton";
import { Input } from "../../ui/Input";
import { Popover } from "../../ui/Popover";
import { Select } from "../../ui/Select";
import { Toggle } from "../../ui/Toggle";
import {
  cx,
  MUTED,
  TRACKER_PANE_FILL,
  VIDEO_FRAME,
  VIDEO_FRAME_FILL,
  VIDEO_PANEL,
  VIDEO_STAGE,
  VIDEO_STAGE_FILL,
  VIDEO_STAGE_NOTE,
} from "../../ui/styles";
import type { Clip } from "../clips";
import { Kbd } from "../tracker/Kbd";
import { SeekBar } from "../tracker/SeekBar";
import { TransportButton } from "../tracker/TransportButton";
import { RATES } from "../tracker/VideoPanel";
import type { Player, PlayerStage } from "../usePlayer";

type ClipPlayerProps = {
  player: Player;
  ytHostRef: PlayerStage["ytHostRef"];
  /** The clip playing, its place in the list, and what it shows. */
  clip: Clip | undefined;
  index: number;
  count: number;
  label: string;
  /** Fill the pane it sits in, the video as large as fits; otherwise the video is as wide as the page. */
  fill: boolean;
  rotation: number;
  onRotate: () => void;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReplay: () => void;
  loop: boolean;
  onLoop: (loop: boolean) => void;
  rate: number;
  onRate: (rate: number) => void;
  /** Seconds shown before and after each moment. */
  before: number;
  after: number;
  onPadding: (padding: { before?: number; after?: number }) => void;
};

/** The highlights' video with what is playing, a seek bar over the clip, and the playback controls. */
export function ClipPlayer({
  player,
  ytHostRef,
  clip,
  index,
  count,
  label,
  fill,
  rotation,
  onRotate,
  onToggle,
  onPrev,
  onNext,
  onReplay,
  loop,
  onLoop,
  rate,
  onRate,
  before,
  after,
  onPadding,
}: ClipPlayerProps): JSX.Element {
  const { getTime, source } = player;
  const [time, setTime] = useState(0);
  const first = clip?.actions[0];
  const playable = !!clip?.videoId;

  // Only the seek bar follows the playhead, so the clip list does not render five times a second.
  useEffect(() => {
    if (!playable) return;

    const timer = setInterval(() => setTime(getTime()), 200);

    return () => clearInterval(timer);
  }, [playable, getTime]);

  return (
    <section className={cx(VIDEO_PANEL, fill && TRACKER_PANE_FILL)} aria-label="Video">
      <div className={fill ? VIDEO_STAGE_FILL : VIDEO_STAGE}>
        <div className={fill ? VIDEO_FRAME_FILL : VIDEO_FRAME}>
          <div
            ref={ytHostRef}
            className={source ? "h-full w-full" : "hidden"}
            // A 90°-rotated 16:9 video must shrink to fit inside the 16:9 frame.
            style={{ transform: `rotate(${rotation}deg) scale(${rotation % 180 === 0 ? 1 : 9 / 16})` }}
          />
          {/* Shield the iframe: if it ever gets focus it swallows every keyboard shortcut. */}
          {source && <div className="absolute inset-0 cursor-pointer" onClick={player.toggle} />}
        </div>
        {!source && !clip && <p className={cx(VIDEO_STAGE_NOTE, "absolute")}>Pick filters, then press Play all</p>}
      </div>

      <div className="flex flex-none flex-col gap-2 px-3 pb-3">
        <div className="flex min-h-5 flex-wrap items-baseline justify-between gap-x-3 text-sm">
          {clip && !playable && <p className="m-0 text-danger">This set has no YouTube link.</p>}
          {first && playable && (
            <>
              <p className="m-0 min-w-0 truncate font-semibold">{label}</p>
              <p className="m-0 text-text-dim">
                Clip {index + 1} of {count} · {first.match} · {first.set} · {first.score}
              </p>
            </>
          )}
          {!count && <p className={MUTED}>No actions match the selection.</p>}
        </div>
        {clip && playable && (
          <SeekBar
            time={time}
            start={clip.start}
            end={clip.end}
            onSeek={(t) => {
              player.seek(t);
              setTime(t);
            }}
            markers={clip.actions.map((a) => ({ time: a.time, tone: null }))}
          />
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <TransportButton onClick={onPrev} title="Previous clip" kbd="↑">
            <SkipBack size={16} aria-hidden="true" />
          </TransportButton>
          <Button size="sm" onClick={onToggle} disabled={!count}>
            {clip && player.isPlaying ? (
              <>
                <Pause size={15} aria-hidden="true" /> Pause
              </>
            ) : (
              <>
                <Play size={15} aria-hidden="true" /> {clip ? "Resume" : "Play all"}
              </>
            )}
            <Kbd onAccent>Space</Kbd>
          </Button>
          <TransportButton onClick={onNext} title="Next clip" kbd="↓">
            <SkipForward size={16} aria-hidden="true" />
          </TransportButton>
          <TransportButton onClick={onReplay} title="Replay the clip" kbd="R">
            <RotateCcw size={16} aria-hidden="true" />
          </TransportButton>
          <Toggle pressed={loop} onPressedChange={onLoop} ariaLabel="Loop the clip">
            <Repeat size={14} aria-hidden="true" /> Loop <Kbd>L</Kbd>
          </Toggle>
          <span className="flex items-center gap-1" title="Playback speed">
            <Select
              variant="quiet"
              ariaLabel="Playback speed"
              value={String(rate)}
              onValueChange={(v) => onRate(parseFloat(v))}
              options={RATES.map((r) => ({ value: String(r), label: `${r}×` }))}
            />
            <Kbd>[</Kbd>
            <Kbd>]</Kbd>
          </span>
          <span className="flex-1" />
          <Popover
            ariaLabel="Padding"
            align="end"
            side="top"
            trigger={
              <Button variant="text" size="sm" title="Seconds shown before and after each moment">
                Padding {before}s · {after}s
              </Button>
            }
          >
            <div className="flex gap-3">
              <Field label="Before" className="w-24">
                <Input
                  type="number"
                  min={0}
                  value={before}
                  onChange={(e) => onPadding({ before: Math.max(0, Number(e.target.value)) })}
                />
              </Field>
              <Field label="After" className="w-24">
                <Input
                  type="number"
                  min={0}
                  value={after}
                  onChange={(e) => onPadding({ after: Math.max(0, Number(e.target.value)) })}
                />
              </Field>
            </div>
          </Popover>
          <IconButton variant="plain" size="sm" aria-label="Rotate the video" onClick={onRotate} disabled={!source}>
            <RotateCw size={16} aria-hidden="true" />
          </IconButton>
        </div>
      </div>
    </section>
  );
}
