import { useState } from "react";
import type { JSX } from "react";
import { Film, Pause, Play, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "../../ui/Button";
import { FileButton } from "../../ui/FileButton";
import { IconButton } from "../../ui/IconButton";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { CALLOUT_WARN, cx, VIDEO_PANEL, VIDEO_STAGE, VIDEO_STAGE_NOTE } from "../../ui/styles";
import { FRAME } from "../usePlayer";
import type { Player, PlayerStage } from "../usePlayer";
import { extractYoutubeId } from "../youtube";
import { Kbd } from "./Kbd";
import { SeekBar } from "./SeekBar";
import { TransportButton } from "./TransportButton";

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
};

/** The match video (YouTube or a local file), its transport, and where to load it from. */
export function VideoPanel({
  player,
  stage: { videoRef, videoEvents, ytHostRef },
  youtubeUrl,
  onYoutubeUrl,
  markers,
  marks,
  onMark,
}: VideoPanelProps): JSX.Element {
  const [urlInput, setUrlInput] = useState(youtubeUrl);
  const [shownUrl, setShownUrl] = useState(youtubeUrl);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const { source } = player;

  // A link set elsewhere (an import, the next set) replaces what the field shows.
  if (shownUrl !== youtubeUrl) {
    setShownUrl(youtubeUrl);
    setUrlInput(youtubeUrl);
  }

  // A 90°-rotated 16:9 video must shrink to fit inside the 16:9 frame.
  const transform = `rotate(${rotation}deg) scale(${zoom * (rotation % 180 === 0 ? 1 : 9 / 16)})`;
  const urlId = extractYoutubeId(urlInput);

  const loadUrl = () => {
    if (!urlId) return;

    onYoutubeUrl(urlInput.trim());
    player.loadYoutube(urlId);
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const step = (dt: number) => {
    player.pause();
    player.seekBy(dt);
  };

  return (
    <section className={VIDEO_PANEL} aria-label="Video">
      <div className={VIDEO_STAGE}>
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
        {!source && (
          <div className={VIDEO_STAGE_NOTE}>
            <Film size={40} className="mx-auto mb-2" aria-hidden="true" />
            <p className="m-0">No video loaded</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 px-3 pb-3">
        {source && (
          <>
            <SeekBar player={player} markers={markers} marks={marks} />
            <div className="flex flex-wrap items-center gap-1.5">
              <TransportButton onClick={player.toggle} title="Play or pause" primary kbd="Space">
                {player.isPlaying ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              </TransportButton>
              <Button
                variant="ghost"
                size="sm"
                paired
                onClick={onMark}
                title="Mark a contact without pausing; describe them all after the rally"
              >
                Mark contact
                {marks.length > 0 && (
                  <span className="rounded-xs bg-accent-weak px-1 tabular-nums">{marks.length}</span>
                )}
                <Kbd>Tab</Kbd>
              </Button>
              <TransportButton onClick={() => player.seekBy(-5)} title="Back 5s" kbd="⇧←">
                -5s
              </TransportButton>
              <TransportButton onClick={() => player.seekBy(-2)} title="Back 2s" kbd="←">
                -2s
              </TransportButton>
              <TransportButton onClick={() => step(-FRAME)} title="Previous frame" kbd=",">
                ◂|
              </TransportButton>
              <TransportButton onClick={() => step(FRAME)} title="Next frame" kbd=".">
                |▸
              </TransportButton>
              <TransportButton onClick={() => player.seekBy(2)} title="Forward 2s" kbd="→">
                +2s
              </TransportButton>
              <TransportButton onClick={() => player.seekBy(5)} title="Forward 5s" kbd="⇧→">
                +5s
              </TransportButton>
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
              {(zoom !== 1 || rotation !== 0) && (
                <Button
                  variant="text"
                  size="sm"
                  onClick={() => {
                    setZoom(1);
                    setRotation(0);
                  }}
                >
                  Reset
                </Button>
              )}
            </div>
          </>
        )}

        <div className={cx("flex flex-wrap gap-2", source && "border-t border-border pt-3")}>
          <FileButton accept="video/*" onFiles={([file]) => player.loadFile(file)}>
            {source?.type === "file" ? source.name : "Load local video"}
          </FileButton>
          <form
            className="flex min-w-64 flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              loadUrl();
            }}
          >
            <Input
              aria-label="YouTube link"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="YouTube link"
              className="flex-1"
            />
            <Button type="submit" variant="ghost" paired disabled={!urlId}>
              Load
            </Button>
          </form>
        </div>
        {urlInput.trim() && !urlId && <p className={CALLOUT_WARN}>That isn’t a YouTube link.</p>}
      </div>
    </section>
  );
}
