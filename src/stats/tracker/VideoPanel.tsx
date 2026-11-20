import { useState } from "react";
import type { JSX } from "react";
import { Ellipsis, Film, Pause, Play, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "../../ui/Button";
import { IconButton } from "../../ui/IconButton";
import { Popover } from "../../ui/Popover";
import { Select } from "../../ui/Select";
import {
  cx,
  TRACKER_PANE_FILL,
  VIDEO_FRAME,
  VIDEO_FRAME_FILL,
  VIDEO_PANEL,
  VIDEO_STAGE,
  VIDEO_STAGE_FILL,
  VIDEO_STAGE_NOTE,
} from "../../ui/styles";
import type { Player, PlayerStage } from "../usePlayer";
import { Kbd } from "./Kbd";
import { LOCKED_HINT } from "./locked";
import { SeekBar } from "./SeekBar";
import { TransportButton } from "./TransportButton";
import { VideoSource } from "./VideoSource";

export const RATES = [0.25, 0.5, 0.75, 1, 1.5, 2];

type VideoPanelProps = {
  player: Player;
  stage: PlayerStage;
  youtubeUrl: string;
  onYoutubeUrl: (url: string) => void;
  markers: readonly { time: number; tone: "us" | "them" | null }[];
  /** Contacts marked during play, still waiting to be described. */
  marks: readonly number[];
  onMark: () => void;
  /** A locked set: its video link stays, and no contacts are marked. */
  locked: boolean;
  /** Fill the pane it sits in, the video as large as fits; otherwise the video is as wide as the page. */
  fill: boolean;
};

/** The match video (YouTube or a local file) with its seek bar, play, mark, and speed; the rest sits in a menu. */
export function VideoPanel({
  player,
  stage: { videoRef, videoEvents, ytHostRef },
  youtubeUrl,
  onYoutubeUrl,
  markers,
  marks,
  onMark,
  locked,
  fill,
}: VideoPanelProps): JSX.Element {
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const { source } = player;
  // A 90°-rotated 16:9 video must shrink to fit inside the 16:9 frame.
  const transform = `rotate(${rotation}deg) scale(${zoom * (rotation % 180 === 0 ? 1 : 9 / 16)})`;
  const sourceControls = (
    <VideoSource player={player} youtubeUrl={youtubeUrl} onYoutubeUrl={onYoutubeUrl} locked={locked} />
  );

  return (
    <section className={cx(VIDEO_PANEL, fill && TRACKER_PANE_FILL)} aria-label="Video">
      <div className={fill ? VIDEO_STAGE_FILL : VIDEO_STAGE}>
        <div className={fill ? VIDEO_FRAME_FILL : VIDEO_FRAME}>
          {source?.type === "file" && (
            <video
              ref={videoRef}
              {...videoEvents}
              src={source.url}
              className="h-full w-full"
              style={{ transform }}
              onClick={player.toggle}
            />
          )}
          <div
            ref={ytHostRef}
            className={source?.type === "youtube" ? "h-full w-full" : "hidden"}
            style={{ transform }}
          />
          {source?.type === "youtube" && (
            // Shield the iframe: if it ever gets focus it swallows every keyboard shortcut.
            <div
              className="absolute inset-0 cursor-pointer"
              onClick={player.toggle}
              title="Click to play/pause (Space)"
            />
          )}
        </div>
        {!source && (
          <div className={cx(VIDEO_STAGE_NOTE, "absolute")}>
            <Film size={40} className="mx-auto mb-2" aria-hidden="true" />
            <p className="m-0">No video loaded</p>
          </div>
        )}
      </div>

      <div className="flex flex-none flex-col gap-2 px-3 pb-3">
        {source ? (
          <>
            <SeekBar player={player} markers={markers} marks={marks} />
            <div className="flex flex-wrap items-center gap-1.5">
              <TransportButton onClick={player.toggle} title="Play or pause" kbd="Space">
                {player.isPlaying ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              </TransportButton>
              <Button
                variant="ghost"
                size="sm"
                paired
                onClick={onMark}
                disabled={locked}
                title={locked ? LOCKED_HINT : "Mark a contact without pausing; describe them all after the rally"}
              >
                Mark contact
                {marks.length > 0 && (
                  <span className="rounded-xs bg-accent-weak px-1 tabular-nums">{marks.length}</span>
                )}
                <Kbd>Tab</Kbd>
              </Button>
              <span className="flex items-center gap-1" title="Playback speed">
                <Select
                  variant="quiet"
                  ariaLabel="Playback speed"
                  value={String(player.rate)}
                  onValueChange={(v) => player.setRate(parseFloat(v))}
                  options={RATES.map((r) => ({ value: String(r), label: `${r}×` }))}
                />
                <Kbd>[</Kbd>
                <Kbd>]</Kbd>
              </span>
              <span className="flex-1" />
              <Popover
                ariaLabel="Video options"
                align="end"
                side="top"
                trigger={
                  <IconButton variant="plain" size="sm" aria-label="Video options" tooltip={null} title="Video options">
                    <Ellipsis size={16} aria-hidden="true" />
                  </IconButton>
                }
              >
                <div className="flex w-80 flex-col gap-3">
                  <div className="flex items-center gap-1">
                    <IconButton
                      variant="plain"
                      size="sm"
                      aria-label="Rotate counterclockwise"
                      onClick={() => setRotation((r) => (r + 270) % 360)}
                    >
                      <RotateCcw size={16} aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      variant="plain"
                      size="sm"
                      aria-label="Rotate clockwise"
                      onClick={() => setRotation((r) => (r + 90) % 360)}
                    >
                      <RotateCw size={16} aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      variant="plain"
                      size="sm"
                      aria-label="Zoom out"
                      onClick={() => setZoom((z) => Math.max(z - 0.1, 0.5))}
                    >
                      <ZoomOut size={16} aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      variant="plain"
                      size="sm"
                      aria-label="Zoom in"
                      onClick={() => setZoom((z) => Math.min(z + 0.1, 3))}
                    >
                      <ZoomIn size={16} aria-hidden="true" />
                    </IconButton>
                    <span className="flex-1" />
                    <Button
                      variant="text"
                      size="sm"
                      disabled={zoom === 1 && rotation === 0}
                      onClick={() => {
                        setZoom(1);
                        setRotation(0);
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                  {sourceControls}
                </div>
              </Popover>
            </div>
          </>
        ) : (
          <div className="pt-3">{sourceControls}</div>
        )}
      </div>
    </section>
  );
}
