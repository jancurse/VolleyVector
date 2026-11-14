import type { JSX } from "react";

import { Button } from "../../ui/Button";
import { cx, MUTED, PANEL_FLUSH, PANEL_PAD_X, PANEL_TITLE, THEM_TEXT, US_TEXT } from "../../ui/styles";
import type { MatchEvent, Rally } from "../types";
import { EventRow } from "./EventRow";
import { InferredEnd } from "./InferredEnd";

type EventLogProps = {
  rallies: readonly Rally[];
  currentTime: number;
  editingId: number | null;
  onSeek: (t: number) => void;
  onEdit: (e: MatchEvent) => void;
  onDelete: (id: number) => void;
  /** Record why an inferred rally ended, turning it into an explicit point. */
  onAnnotate: (rally: Rally, reason: string) => void;
};

/** How far before an event to seek, so the play leading up to it is visible. */
const SEEK_LEAD = 2;

/** The set's events by rally, newest first; the rally under the playhead is highlighted. */
export function EventLog({
  rallies,
  currentTime,
  editingId,
  onSeek,
  onEdit,
  onDelete,
  onAnnotate,
}: EventLogProps): JSX.Element {
  const total = rallies.reduce((n, r) => n + r.touches.length, 0);
  const visible = rallies.filter((r) => r.touches.length || r.winner || r.subs.length).reverse();

  return (
    <section className={PANEL_FLUSH} aria-labelledby="log-title">
      <div className={cx("flex justify-between", PANEL_PAD_X)}>
        <h2 id="log-title" className={PANEL_TITLE}>
          Recorded stats
        </h2>
        <span className="text-sm text-text-dim">
          {total} touches · {rallies.length - 1} rallies
        </span>
      </div>
      <div className="max-h-event-log overflow-y-auto border-t border-border lg:max-h-none">
        {visible.length === 0 ? (
          <p className={cx(MUTED, "p-6 text-center")}>No stats recorded yet</p>
        ) : (
          visible.map((r) => {
            const live = currentTime >= r.startTime - SEEK_LEAD && currentTime <= r.endTime + 1;
            const winner = r.winner;

            return (
              <div key={r.index} className={cx("border-b border-border", live && "bg-accent-weak")}>
                <Button
                  variant="text"
                  size="sm"
                  className="w-full justify-start rounded-none bg-control px-4"
                  onClick={() => onSeek(r.startTime - SEEK_LEAD)}
                  title="Jump to rally start"
                >
                  <span className="text-text">Rally {r.index}</span>
                  {r.serving && <span className="font-normal">{r.serving === "us" ? "we serve" : "they serve"}</span>}
                  <span className="font-normal">R{r.rotation}</span>
                  <span className="flex-1" />
                  {winner ? (
                    <span className={winner === "us" ? US_TEXT : THEM_TEXT}>
                      {winner === "us" ? "Won" : "Lost"} · {r.score.us}–{r.score.them}
                    </span>
                  ) : (
                    <i className="font-normal">in progress</i>
                  )}
                </Button>
                {r.inferred && winner && (
                  <InferredEnd rally={{ ...r, winner }} onAnnotate={(reason) => onAnnotate(r, reason)} />
                )}
                {[...r.subs, ...r.touches, ...(r.endedBy?.kind === "point" ? [r.endedBy] : [])]
                  .sort((a, b) => b.timestamp - a.timestamp || b.id - a.id)
                  .map((e) => (
                    <EventRow
                      key={e.id}
                      event={e}
                      editing={e.id === editingId}
                      onSeek={() => onSeek(e.timestamp - SEEK_LEAD)}
                      onEdit={() => onEdit(e)}
                      onDelete={() => onDelete(e.id)}
                    />
                  ))}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
