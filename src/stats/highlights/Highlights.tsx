import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { Dispatch, JSX, SetStateAction } from "react";
import { Maximize2, Minimize2, PanelBottom, PanelRight } from "lucide-react";

import { IconButton } from "../../ui/IconButton";
import { HL_STACK, TRACKER_BAR, TRACKER_WORKSPACE } from "../../ui/styles";
import { buildClips, clipLabel, filterActions, highlightActions, highlightRallies, rallyKey } from "../clips";
import type { Clip, Selection } from "../clips";
import { RATES } from "../tracker/VideoPanel";
import type { ReportSet } from "../types";
import { isTyping } from "../typing";
import { usePlayer } from "../usePlayer";
import { ClipList } from "./ClipList";
import { ClipPlayer } from "./ClipPlayer";
import { FilterBar } from "./FilterBar";
import { HighlightPanes, initialPlace, savePlace } from "./HighlightPanes";

type HighlightsProps = {
  sets: readonly ReportSet[];
  /** The filters, kept by the parent so the stats can set them. */
  selection: Selection;
  onSelection: Dispatch<SetStateAction<Selection>>;
  /** False while another view is shown; playback pauses and the shortcuts rest. */
  active: boolean;
  /** Lay the highlights out as resizable panes filling the window; without it, as a plain stacked page. */
  panes?: boolean;
  /** Whether everything around the highlights is hidden, and how to switch that; absent where it cannot be. */
  focus?: boolean;
  onFocus?: (focus: boolean) => void;
};

/** Plays the moments matching a filter from several sets, one clip after another, in one YouTube player. */
export default function Highlights({
  sets,
  selection,
  onSelection: setSelection,
  active,
  panes = false,
  focus = false,
  onFocus,
}: HighlightsProps): JSX.Element {
  const [player, { ytHostRef }] = usePlayer(null, false);
  const actions = useMemo(() => sets.flatMap((s, i) => highlightActions(s, i)), [sets]);
  const rallies = useMemo(
    () => new Map(sets.flatMap((s, i) => highlightRallies(s, i)).map((r) => [rallyKey(r), r])),
    [sets]
  );
  const [padding, setPadding] = useState({ before: 3, after: 3 });
  const [current, setCurrent] = useState(-1);
  const [rotations, setRotations] = useState<Record<string, number>>({});
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [place, setPlace] = useState(initialPlace);
  const [gamesOpen, setGamesOpen] = useState(false);
  const clips = useMemo(
    () => buildClips(filterActions(actions, selection), padding.before, padding.after),
    [actions, selection, padding]
  );
  const [shownClips, setShownClips] = useState(clips);
  // The clip to start once a newly loaded video is ready.
  const pending = useRef<Clip | null>(null);

  // A new filter starts the list over.
  if (shownClips !== clips) {
    setShownClips(clips);
    setCurrent(-1);
  }

  const videoId = player.source?.type === "youtube" ? player.source.id : null;
  const rotation = (videoId && rotations[videoId]) || 0;
  const clip = clips[current];

  const flipPlace = () => {
    const next = place === "beside" ? "below" : "beside";

    setPlace(next);
    savePlace(next);
  };

  const changeRate = (next: number) => {
    setRate(next);
    player.setRate(next);
  };

  const pause = useEffectEvent(() => player.pause());

  useEffect(() => {
    if (!active) pause();
  }, [active]);

  // The clip that was playing is gone with the old list, and so is one waiting for its video.
  useEffect(() => {
    pending.current = null;
    pause();
  }, [clips]);

  const playClip = (i: number) => {
    const next = clips[i];

    if (!next) return;

    setCurrent(i);

    if (!next.videoId) return;

    if (next.videoId === videoId && player.duration) {
      player.seek(next.start);
      player.play();
    } else {
      pending.current = next;
      if (next.videoId !== videoId) player.loadYoutube(next.videoId);
    }
  };

  // Start the waiting clip once its video has loaded, at the speed the last one played.
  const startPending = useEffectEvent(() => {
    const clipToStart = pending.current;

    if (!clipToStart || !player.duration || clipToStart.videoId !== videoId) return;

    pending.current = null;
    player.seek(clipToStart.start);
    if (rate !== 1) player.setRate(rate);
    player.play();
  });

  useEffect(() => startPending(), [player.duration, videoId]);

  // When the playhead passes the end of this clip, play it again or move on, checked while playing.
  const advance = useEffectEvent(() => {
    if (!clip || player.getTime() < clip.end) return;

    if (loop) {
      player.seek(clip.start);
    } else if (current + 1 < clips.length) {
      playClip(current + 1);
    } else {
      player.pause();
      setCurrent(-1);
    }
  });

  useEffect(() => {
    if (!player.isPlaying) return;

    const timer = setInterval(() => advance(), 100);

    return () => clearInterval(timer);
  }, [player.isPlaying]);

  const toggle = () => (clip ? player.toggle() : playClip(0));
  const prev = () => playClip(Math.max(0, current - 1));
  const next = () => playClip(current + 1);

  const replay = () => {
    if (!clip?.videoId) return;

    player.seek(clip.start);
    player.play();
  };

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (!active || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    // A focused select steps through its own options with the arrows.
    if (e.key.startsWith("Arrow") && (e.target as HTMLElement).closest?.("[role=combobox]")) return;

    const run: Record<string, (() => void) | undefined> = {
      " ": toggle,
      ArrowUp: prev,
      ArrowDown: next,
      ArrowLeft: () => player.seekBy(e.shiftKey ? -5 : -2),
      ArrowRight: () => player.seekBy(e.shiftKey ? 5 : 2),
      r: replay,
      l: () => setLoop(!loop),
      "[": () => changeRate(RATES[Math.max(RATES.indexOf(rate) - 1, 0)]),
      "]": () => changeRate(RATES[Math.min(RATES.indexOf(rate) + 1, RATES.length - 1)]),
      f: () => setGamesOpen(true),
      x: panes ? flipPlace : undefined,
      v: onFocus && (() => onFocus(!focus)),
    };
    const action = run[e.key.length === 1 ? e.key.toLowerCase() : e.key];

    if (!action) return;

    e.preventDefault();
    action();
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e);

    // Capture phase on window, so no focused element can swallow a shortcut first.
    window.addEventListener("keydown", h, { capture: true });

    return () => window.removeEventListener("keydown", h, { capture: true });
  }, []);

  const video = (
    <ClipPlayer
      player={player}
      ytHostRef={ytHostRef}
      clip={clip}
      index={current}
      count={clips.length}
      label={clip ? clipLabel(clip, rallies) : ""}
      fill={panes}
      rotation={rotation}
      onRotate={() => videoId && setRotations((r) => ({ ...r, [videoId]: (rotation + 90) % 360 }))}
      onToggle={toggle}
      onPrev={prev}
      onNext={next}
      onReplay={replay}
      loop={loop}
      onLoop={setLoop}
      rate={rate}
      onRate={changeRate}
      before={padding.before}
      after={padding.after}
      onPadding={(p) => setPadding((old) => ({ ...old, ...p }))}
    />
  );
  const list = <ClipList clips={clips} current={current} rallies={rallies} onPlay={playClip} fill={panes} />;

  return (
    <div className={panes ? TRACKER_WORKSPACE : HL_STACK}>
      <header className={TRACKER_BAR}>
        <FilterBar
          actions={actions}
          selection={selection}
          onChange={(patch) => setSelection((old) => ({ ...old, ...patch }))}
          gamesOpen={gamesOpen}
          onGamesOpen={setGamesOpen}
        />
        <div className="flex items-center gap-1">
          {panes && (
            <IconButton
              variant="plain"
              size="sm"
              aria-label={place === "beside" ? "Put the clips under the video" : "Put the clips beside the video"}
              tooltip={place === "beside" ? "Clips under the video (X)" : "Clips beside the video (X)"}
              onClick={flipPlace}
            >
              {place === "beside" ? (
                <PanelBottom size={16} aria-hidden="true" />
              ) : (
                <PanelRight size={16} aria-hidden="true" />
              )}
            </IconButton>
          )}
          {onFocus && (
            <IconButton
              variant="plain"
              size="sm"
              aria-label={focus ? "Leave focus mode" : "Focus mode"}
              tooltip={focus ? "Show the rest of the page (V)" : "Show only the highlights (V)"}
              aria-pressed={focus}
              onClick={() => onFocus(!focus)}
            >
              {focus ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
            </IconButton>
          )}
        </div>
      </header>

      {panes ? (
        <HighlightPanes place={place} video={video} clips={list} />
      ) : (
        <>
          {video}
          {list}
        </>
      )}
    </div>
  );
}
