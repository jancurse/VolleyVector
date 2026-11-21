import { useEffect, useRef } from "react";
import type { JSX } from "react";

import { Button } from "../../ui/Button";
import { ExternalLink } from "../../ui/ExternalLink";
import {
  cx,
  HL_CLIP_ROW,
  HL_LIST,
  MUTED,
  PANEL_FLUSH,
  PANEL_PAD_X,
  PANEL_TITLE,
  THEM_RULE,
  US_RULE,
} from "../../ui/styles";
import { clipActions, clipLabel, clipRally, youtubeAt } from "../clips";
import type { Clip, RallySummary } from "../clips";
import { formatTime } from "../exporters";
import { shortSet } from "./picker";

type ClipListProps = {
  clips: readonly Clip[];
  /** The clip playing, or -1. */
  current: number;
  rallies: ReadonlyMap<string, RallySummary>;
  onPlay: (index: number) => void;
  /** Fill the pane it sits in and scroll inside it. */
  fill: boolean;
};

/** The clips in playing order, each with a rule in the colour of who won its rally; the one playing is marked. */
export function ClipList({ clips, current, rallies, onPlay, fill }: ClipListProps): JSX.Element {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    listRef.current?.children[current]?.scrollIntoView({ block: "nearest" });
  }, [current]);

  return (
    <section className={cx(PANEL_FLUSH, fill && "h-full min-h-0")} aria-labelledby="clips-title">
      <div className={cx("flex justify-between", PANEL_PAD_X)}>
        <h2 id="clips-title" className={PANEL_TITLE}>
          Clips
        </h2>
        <span className="text-sm text-text-dim">
          {clips.length} clips · {formatTime(clips.reduce((sum, c) => sum + c.end - c.start, 0))}
        </span>
      </div>
      {clips.length === 0 && <p className={cx(MUTED, "border-t border-border p-6 text-center")}>No clips</p>}
      <ol
        ref={listRef}
        className={cx(
          "m-0 list-none border-t border-border p-0 text-sm",
          fill ? "min-h-0 flex-1 overflow-y-auto" : HL_LIST
        )}
      >
        {clips.map((c, i) => {
          const a = c.actions[0];
          const label = `${shortSet(a.set)} ${a.score}`;
          const won = clipRally(c, rallies)?.won;

          return (
            <li
              key={`${a.match}|${a.set}|${c.start}`}
              title={`${a.match} · ${formatTime(c.start)}–${formatTime(c.end)}`}
              aria-current={i === current || undefined}
              className={cx(
                HL_CLIP_ROW,
                won === undefined ? "border-l-transparent" : won ? US_RULE : THEM_RULE,
                i === current ? "bg-accent-weak font-semibold" : "hover:bg-control-hover"
              )}
              onClick={() => onPlay(i)}
            >
              <span className="text-right text-text-dim tabular-nums">{i + 1}</span>
              {/* Opens the moment on YouTube in a new tab, e.g. to share it. */}
              {c.videoId ? (
                <ExternalLink
                  href={youtubeAt(c.videoId, c.start)}
                  title="Open on YouTube"
                  onClick={(e) => e.stopPropagation()}
                >
                  {label}
                </ExternalLink>
              ) : (
                <span className="text-text-dim">{label}</span>
              )}
              <Button
                variant="text"
                size="sm"
                className="min-w-0 justify-start px-0 text-text"
                title={c.actions.length > 1 ? clipActions(c) : undefined}
              >
                <span className="truncate">{clipLabel(c, rallies)}</span>
              </Button>
              <span className="text-right text-xs font-normal text-text-dim tabular-nums">
                {Math.round(c.end - c.start)}s
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
