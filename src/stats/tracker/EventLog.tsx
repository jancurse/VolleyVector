import { useEffect, useRef } from "react";
import type { JSX, ReactNode } from "react";
import { Trash2, Volleyball } from "lucide-react";

import { IconButton } from "../../ui/IconButton";
import {
  cx,
  MUTED,
  PANEL_FLUSH,
  PANEL_PAD_X,
  PANEL_TITLE,
  TAG_CHIP,
  THEM_RULE,
  THEM_TEXT,
  US_RULE,
  US_TEXT,
} from "../../ui/styles";
import { formatTime } from "../exporters";
import { RALLY_LEAD } from "../setDraft";
import { possessions, sameRow } from "../timeline";
import type { TimelineGroup, TimelineItem } from "../timeline";
import type { Rally } from "../types";
import { ContactRow } from "./ContactRow";
import { EventRow } from "./EventRow";
import { RallyEnd } from "./RallyEnd";

type EventLogProps = {
  rallies: readonly Rally[];
  /** The set's rows by rally, oldest first: what is recorded, and the contacts still to describe. */
  groups: readonly TimelineGroup[];
  /** The two teams' names, to say who serves a rally. */
  names: { us: string; them: string };
  /** How many contacts are still to describe. */
  pending: number;
  currentTime: number;
  /** The row open in the entry, or the one picked. */
  current: { kind: "event" | "contact"; id: number } | null;
  /** A locked set: its events can be watched, not changed. */
  locked: boolean;
  /** Fill the pane it sits in and scroll inside it. */
  fill: boolean;
  /** The score row, above the list. */
  score: ReactNode;
  onSeek: (t: number) => void;
  /** Jump to a row and pick it, without opening it. */
  onPick: (item: TimelineItem) => void;
  /** Open a row: a contact to describe it, a recorded event to change it. */
  onOpen: (item: TimelineItem) => void;
  onDelete: (id: number) => void;
  onDeleteContact: (id: number) => void;
  /** Remove a rally known from the draft alone, by the time of its serve. */
  onDropRally: (start: number) => void;
  /** Record why an inferred rally ended, turning it into an explicit point. */
  onAnnotate: (rally: Rally, reason: string) => void;
};

/** A serve, recorded or still to describe, whose row shows who serves the rally. Without one, the header does. */
const isServe = (item: TimelineItem): boolean =>
  item.kind === "contact"
    ? item.contact.skill === "serve" && !!item.contact.side
    : item.event.kind === "opponent" || (item.event.kind === "touch" && item.event.stat === "serve");

/** A point recorded by hand, which shows as its rally's end and has no row of its own. */
const isPoint = (item: TimelineItem): item is TimelineItem & { kind: "event" } =>
  item.kind === "event" && item.event.kind === "point";

/**
 * The set in the order it happened, by rally and inside a rally by possession. A rally opens with its start and
 * closes with its end and result. A possession is one line of up to three touches side by side once the pane is wide
 * enough, so one with a touch missing is shorter than the rest. The open row is kept in view, and otherwise the rally
 * under the playhead.
 */
export function EventLog({
  rallies,
  groups,
  names,
  pending,
  currentTime,
  current,
  locked,
  fill,
  score,
  onSeek,
  onPick,
  onOpen,
  onDelete,
  onDeleteContact,
  onDropRally,
  onAnnotate,
}: EventLogProps): JSX.Element {
  const list = useRef<HTMLDivElement>(null);
  const total = rallies.reduce((n, r) => n + r.touches.filter((t) => t.id >= 0).length, 0);
  const live = groups.filter((g) => currentTime >= g.start - RALLY_LEAD && currentTime <= g.end).at(-1)?.key;
  const row = (item: TimelineItem) =>
    item.kind === "contact" ? (
      <ContactRow
        key={`contact-${item.contact.id}`}
        contact={item.contact}
        opponent={names.them}
        current={!!current && sameRow(item, current)}
        locked={locked}
        onPick={() => onPick(item)}
        onOpen={() => onOpen(item)}
        onDelete={() => onDeleteContact(item.contact.id)}
      />
    ) : (
      <EventRow
        key={item.event.id}
        event={item.event}
        opponent={names.them}
        current={!!current && sameRow(item, current)}
        locked={locked}
        onPick={() => onPick(item)}
        // A substitution has nothing to change: delete and redo it instead.
        onOpen={item.event.kind === "sub" ? undefined : () => onOpen(item)}
        onDelete={() => onDelete(item.event.id)}
      />
    );

  useEffect(() => {
    const target = list.current?.querySelector("[data-current]") ?? list.current?.querySelector("[data-live]");

    target?.scrollIntoView?.({ block: "nearest" });
  }, [current?.kind, current?.id, live, pending, total]);

  return (
    <section className={cx(PANEL_FLUSH, fill && "h-full min-h-0")} aria-labelledby="log-title">
      {score}
      <div className={cx("flex flex-wrap items-center justify-between gap-x-3", PANEL_PAD_X)}>
        <h2 id="log-title" className={PANEL_TITLE}>
          Recorded stats
        </h2>
        <span className="flex items-center gap-2 text-sm text-text-dim">
          {total} touches · {rallies.length - 1} rallies
          {pending > 0 && <span className={cx(TAG_CHIP, "text-accent")}>{pending} to describe</span>}
        </span>
      </div>
      <div
        ref={list}
        className={cx(
          "@container overflow-y-auto border-t border-border bg-bg px-2 pb-2",
          fill ? "min-h-0 flex-1" : "max-h-event-log"
        )}
      >
        {groups.length === 0 ? (
          <p className={cx(MUTED, "p-6 text-center")}>No stats recorded yet</p>
        ) : (
          groups.map(({ key, rally: r, start, end, items, pending: open, settled, outline }) => {
            const point = items.find(isPoint);

            return (
              <div
                key={key}
                data-live={key === live || undefined}
                className={cx(
                  "mt-3 overflow-hidden rounded-lg border-l-4 bg-panel pb-1 shadow-sm",
                  !r.winner || !settled ? "border-l-border" : r.winner === "us" ? US_RULE : THEM_RULE,
                  key === live && "ring-2 ring-accent"
                )}
              >
                <div className="flex items-center pr-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-3 border-0 bg-transparent pt-2 pr-3 pb-1 pl-3 text-left text-sm text-text-dim hover:text-text"
                    onClick={() => onSeek(Math.max(0, start - RALLY_LEAD))}
                    title="Jump to the rally’s start"
                  >
                    <span className="w-14 flex-none px-2 tabular-nums">
                      {formatTime(Math.max(0, start - RALLY_LEAD))}
                    </span>
                    <span className="text-base font-bold text-text">Rally {r.index}</span>
                    {r.serving && !items.some(isServe) && (
                      <span
                        className={cx(
                          "inline-flex items-center gap-1 font-normal",
                          r.serving === "us" ? US_TEXT : THEM_TEXT
                        )}
                      >
                        <Volleyball size={12} aria-label="Serves" />
                        {names[r.serving]}
                      </span>
                    )}
                    <span className="font-normal">R{r.rotation}</span>
                    <span className="flex-1" />
                    {open > 0 && <span className="font-normal text-accent">{open} to describe</span>}
                  </button>
                  {outline && !locked && (
                    <IconButton
                      variant="plain"
                      size="sm"
                      aria-label={`Remove rally ${r.index}`}
                      tooltip="Not a rally: remove it"
                      onClick={() => onDropRally(start)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </IconButton>
                  )}
                </div>
                {possessions(items.filter((item) => !isPoint(item))).map((p, i) => (
                  <div
                    key={i}
                    aria-label={p.side === "us" ? "Our possession" : p.side === "them" ? "Their possession" : undefined}
                    role={p.side ? "group" : undefined}
                    className={cx(
                      "mx-2 mt-1 grid overflow-hidden rounded-md @2xl:grid-cols-3",
                      p.side === "us" && "bg-control"
                    )}
                  >
                    {p.items.map(row)}
                  </div>
                ))}
                {r.winner && (
                  <RallyEnd
                    rally={{ ...r, winner: r.winner }}
                    end={end}
                    settled={settled}
                    outline={outline}
                    locked={locked}
                    current={!!current && !!point && sameRow(point, current)}
                    onPick={() => (point ? onPick(point) : onSeek(end))}
                    onOpen={point && (() => onOpen(point))}
                    onDelete={point && (() => onDelete(point.event.id))}
                    onAnnotate={(reason) => onAnnotate(r, reason)}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
