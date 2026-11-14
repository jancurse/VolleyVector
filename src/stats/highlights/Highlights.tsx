import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { Dispatch, JSX, SetStateAction } from "react";
import { Pause, Play, RotateCw, SkipBack, SkipForward } from "lucide-react";

import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Input } from "../../ui/Input";
import {
  cx,
  FIELD_LABEL,
  HL_CLIPS,
  HL_FILTERS,
  HL_GRID,
  HL_LIST,
  HL_VIDEO,
  HL_VIDEO_WIDTH,
  MUTED,
  VIDEO_STAGE,
  VIDEO_STAGE_NOTE,
} from "../../ui/styles";
import {
  buildClips,
  filterActions,
  FILTER_FIELDS,
  highlightActions,
  highlightRallies,
  rallyKey,
  youtubeAt,
} from "../clips";
import type { Clip, FilterField, HighlightAction, RallySummary, Selection } from "../clips";
import { formatTime } from "../exporters";
import type { ReportSet } from "../types";
import { usePlayer } from "../usePlayer";
import { FilterChips } from "./FilterChips";
import { ExternalLink } from "../../ui/ExternalLink";

const describe = (a: HighlightAction): string => `${a.player} · ${a.action} ${a.outcome}`;

/** "Won · 7 touches · 17s · Mira · Attack Kill" */
const summarize = (r: RallySummary): string =>
  [
    r.won ? "Won" : "Lost",
    `${r.touches} ${r.touches === 1 ? "touch" : "touches"}`,
    r.touches ? `${Math.round(r.end - r.start)}s` : "",
    r.ended,
  ]
    .filter(Boolean)
    .join(" · ");

type HighlightsProps = {
  sets: readonly ReportSet[];
  /** The filters, kept by the parent so the stats can set them. */
  selection: Selection;
  onSelection: Dispatch<SetStateAction<Selection>>;
  /** False while another view is shown; playback pauses. */
  active: boolean;
};

/** Plays the moments matching a filter from several sets, one clip after another, in one YouTube player. */
export default function Highlights({
  sets,
  selection,
  onSelection: setSelection,
  active,
}: HighlightsProps): JSX.Element {
  const [player, { ytHostRef }] = usePlayer(null, false);
  const actions = useMemo(() => sets.flatMap((s, i) => highlightActions(s, i)), [sets]);
  const rallies = useMemo(
    () => new Map(sets.flatMap((s, i) => highlightRallies(s, i)).map((r) => [rallyKey(r), r])),
    [sets]
  );
  const [before, setBefore] = useState(5);
  const [after, setAfter] = useState(3);
  const [current, setCurrent] = useState(-1);
  const [rotations, setRotations] = useState<Record<string, number>>({});
  const clips = useMemo(
    () => buildClips(filterActions(actions, selection), before, after),
    [actions, selection, before, after]
  );
  const [shownClips, setShownClips] = useState(clips);
  // The clip to start once a newly loaded video is ready.
  const pending = useRef<Clip | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  // A new filter starts the list over.
  if (shownClips !== clips) {
    setShownClips(clips);
    setCurrent(-1);
  }

  const videoId = player.source?.type === "youtube" ? player.source.id : null;
  const rotation = (videoId && rotations[videoId]) || 0;
  // A 90°-rotated 16:9 video must shrink to fit inside the 16:9 frame.
  const transform = `rotate(${rotation}deg) scale(${rotation % 180 === 0 ? 1 : 9 / 16})`;
  const clip = clips[current];

  // A clip of one action names it; a clip covering several (usually a whole rally) gets a short summary of
  // its rally instead, with the actions in its tooltip.
  const describeClip = (c: Clip): string => {
    const rally = c.actions.length > 1 ? rallies.get(rallyKey(c.actions[c.actions.length - 1])) : undefined;

    return rally ? summarize(rally) : c.actions.map(describe).join(", ");
  };

  const pause = useEffectEvent(() => player.pause());

  useEffect(() => {
    if (!active) pause();
  }, [active]);

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

  // Start the waiting clip once its video has loaded.
  const startPending = useEffectEvent(() => {
    const clipToStart = pending.current;

    if (!clipToStart || !player.duration || clipToStart.videoId !== videoId) return;

    pending.current = null;
    player.seek(clipToStart.start);
    player.play();
  });

  useEffect(() => startPending(), [player.duration, videoId]);

  // Move on to the next clip when the playhead passes the end of this one, checked while playing.
  const advance = useEffectEvent(() => {
    if (!clip || player.getTime() < clip.end) return;

    if (current + 1 < clips.length) {
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

  useEffect(() => {
    listRef.current?.children[current]?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const toggle = (field: FilterField, value: string) =>
    setSelection((s) => {
      const values = new Set(s[field]);

      if (values.has(value)) values.delete(value);
      else values.add(value);

      return { ...s, [field]: values };
    });

  const total = clips.reduce((sum, c) => sum + c.end - c.start, 0);
  const first = clip?.actions[0];

  return (
    <div className="@container">
      <div className={HL_GRID}>
        <div className={HL_FILTERS}>
          {FILTER_FIELDS.map((field) => (
            <FilterChips
              key={field}
              field={field}
              actions={actions}
              selection={selection}
              onToggle={toggle}
              onClear={() => setSelection((s) => ({ ...s, [field]: new Set() }))}
            />
          ))}
          <div className="flex flex-col gap-1.5">
            <h3 className={FIELD_LABEL}>Padding (seconds)</h3>
            <div className="flex gap-3">
              <Field label="Before" className="w-24">
                <Input
                  type="number"
                  min={0}
                  value={before}
                  onChange={(e) => setBefore(Math.max(0, Number(e.target.value)))}
                />
              </Field>
              <Field label="After" className="w-24">
                <Input
                  type="number"
                  min={0}
                  value={after}
                  onChange={(e) => setAfter(Math.max(0, Number(e.target.value)))}
                />
              </Field>
            </div>
          </div>
        </div>

        <div className={HL_VIDEO}>
          <div className={cx(VIDEO_STAGE, HL_VIDEO_WIDTH, "rounded-md")}>
            <div ref={ytHostRef} className={videoId ? "h-full w-full" : "hidden"} style={{ transform }} />
            {videoId && <div className="absolute inset-0 cursor-pointer" onClick={player.toggle} />}
            {!videoId && <p className={VIDEO_STAGE_NOTE}>Pick filters, then press Play all</p>}
          </div>
          <div className={cx(HL_VIDEO_WIDTH, "min-h-11 text-sm")}>
            {clip && !clip.videoId && <p className="m-0 text-danger">This set has no YouTube link.</p>}
            {first && clip.videoId && (
              <>
                <p className="m-0 font-semibold">{describeClip(clip)}</p>
                <p className="m-0 text-text-dim">
                  Clip {current + 1} of {clips.length} · {first.match} · {first.set} · {first.score}
                </p>
              </>
            )}
            {!clips.length && <p className={MUTED}>No actions match the selection.</p>}
          </div>
          <div className={cx(HL_VIDEO_WIDTH, "flex flex-wrap items-center gap-2")}>
            <Button variant="ghost" paired onClick={() => playClip(Math.max(0, current - 1))}>
              <SkipBack size={15} aria-hidden="true" /> Prev
            </Button>
            {current >= 0 && player.isPlaying ? (
              <Button onClick={player.pause}>
                <Pause size={15} aria-hidden="true" /> Pause
              </Button>
            ) : (
              <Button onClick={() => (current >= 0 ? player.play() : playClip(0))} disabled={!clips.length}>
                <Play size={15} aria-hidden="true" /> {current >= 0 ? "Resume" : "Play all"}
              </Button>
            )}
            <Button variant="ghost" paired onClick={() => playClip(current + 1)}>
              <SkipForward size={15} aria-hidden="true" /> Next
            </Button>
            <Button
              variant="ghost"
              paired
              onClick={() => videoId && setRotations((r) => ({ ...r, [videoId]: (rotation + 90) % 360 }))}
            >
              <RotateCw size={15} aria-hidden="true" /> Rotate
            </Button>
          </div>
        </div>

        <div className={HL_CLIPS}>
          <p className="m-0 pb-1 text-sm text-text-dim">
            {clips.length} clips · {formatTime(total)}
          </p>
          <ol ref={listRef} className={cx(HL_LIST, "m-0 list-none border-t border-border p-0 text-sm")}>
            {clips.map((c, i) => {
              const a = c.actions[0];
              const label = `${a.set.replace("Set ", "S")} ${a.score}`;

              return (
                <li
                  key={`${a.match}|${a.set}|${c.start}`}
                  title={`${a.match} · ${formatTime(c.start)}–${formatTime(c.end)}`}
                  className={cx(
                    "grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2 border-b border-border px-1",
                    i === current && "bg-accent-weak"
                  )}
                >
                  <span className="text-text-dim">{i + 1}</span>
                  {/* Opens the moment on YouTube in a new tab, e.g. to share it. */}
                  {c.videoId ? (
                    <ExternalLink href={youtubeAt(c.videoId, c.start)} title="Open on YouTube">
                      {label}
                    </ExternalLink>
                  ) : (
                    <span className="text-text-dim">{label}</span>
                  )}
                  <Button
                    variant="text"
                    size="sm"
                    className="justify-start truncate text-text"
                    onClick={() => playClip(i)}
                    title={c.actions.length > 1 ? c.actions.map(describe).join("\n") : undefined}
                  >
                    {describeClip(c)}
                  </Button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
