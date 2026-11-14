import type { JSX } from "react";

import { Button } from "../../ui/Button";
import { Collapsible, CollapsibleCaret, CollapsiblePanel } from "../../ui/Collapsible";
import { Field } from "../../ui/Field";
import { Select } from "../../ui/Select";
import { CALLOUT_WARN, cx, PANEL, POINT_BUTTON, THEM_TINT, US_TINT } from "../../ui/styles";
import { POINT_REASONS } from "../codes";
import type { MatchMeta, Rally, Team } from "../types";
import { Kbd } from "./Kbd";
import { TeamScore } from "./TeamScore";

type ScoreboardProps = {
  rally: Rally;
  meta: MatchMeta;
  /** Our name and the opponent's, as the scoreboard labels them. */
  names: { us: string; them: string };
  hasEvents: boolean;
  /** A just-recorded manual point still waiting for an (optional) reason. */
  pending: { id: number; winner: Team } | null;
  notice: string | null;
  onPoint: (winner: Team, reason?: string) => void;
  onReason: (reason: string) => void;
  onMeta: (meta: Partial<MatchMeta>) => void;
};

/** The live score, serve and rotation, the manual point buttons, and the set's first serve and rotation. */
export function Scoreboard({
  rally,
  meta,
  names,
  hasEvents,
  pending,
  notice,
  onPoint,
  onReason,
  onMeta,
}: ScoreboardProps): JSX.Element {
  return (
    <section className={PANEL} aria-label="Scoreboard">
      <div className="grid grid-cols-2 divide-x divide-border">
        <TeamScore side="us" name={names.us} score={rally.score.us} serving={rally.serving === "us"} />
        <TeamScore side="them" name={names.them} score={rally.score.them} serving={rally.serving === "them"} />
      </div>
      <div className="flex justify-between border-t border-border pt-2 text-xs text-text-dim">
        <span>Rally #{rally.index}</span>
        <span>
          Rotation <b className="text-text">{rally.rotation}</b>
        </span>
        <span>{rally.touches.length} touches so far</span>
      </div>

      <Collapsible key={pending ? "open" : "closed"} defaultOpen={!!pending}>
        <div className="flex items-center gap-1 border-t border-border pt-2 text-xs text-text-dim">
          <CollapsibleCaret label="Manual point" />
          <span>
            <b className="text-text">Manual point</b> <Kbd>+</Kbd> <Kbd>-</Kbd>: rarely needed, since winners are
            inferred from who serves next.
          </span>
        </div>
        <CollapsiblePanel className="flex flex-col gap-2 pt-2">
          <p className="m-0 text-xs text-text-dim">
            Use for an <b>untouched ace</b>, the <b>last rally of a set</b>, or to note <b>why</b> a rally ended
            (opponent errors). If one of our players touched the ball last, record that touch instead (e.g. Defense →
            Error).
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["us", "them"] as const).map((side) => {
              const waiting = pending?.winner === side;
              const key = side === "us" ? "+" : "-";

              return (
                <div key={side} className={cx("flex flex-col gap-1 rounded-md", waiting && "p-1 ring-2 ring-accent")}>
                  <button
                    type="button"
                    onClick={() => onPoint(side)}
                    className={cx(POINT_BUTTON, side === "us" ? US_TINT : THEM_TINT)}
                    title={
                      side === "us"
                        ? "Rally won by us without one of our touches deciding it (e.g. opponent error)"
                        : "Rally won by the opponent without one of our touches deciding it"
                    }
                  >
                    Point {names[side]} <Kbd>{key}</Kbd>
                  </button>
                  {waiting && (
                    <p className="m-0 px-1 text-2xs text-text-dim">Why? Press a number (optional), Esc to skip</p>
                  )}
                  {POINT_REASONS[side].map((r, i) => (
                    <Button
                      key={r.id}
                      variant="ghost"
                      size="sm"
                      className="justify-between"
                      onClick={() => (waiting ? onReason(r.id) : onPoint(side, r.id))}
                      title={waiting ? "Set the reason for the point just recorded" : "Record a point with this reason"}
                    >
                      <span className="truncate">{r.label}</span>
                      <Kbd dim={!waiting}>{waiting ? i + 1 : `${key} ${i + 1}`}</Kbd>
                    </Button>
                  ))}
                </div>
              );
            })}
          </div>
        </CollapsiblePanel>
      </Collapsible>

      {notice && <p className={CALLOUT_WARN}>{notice}</p>}

      {!hasEvents && (
        <div className="flex flex-wrap gap-3">
          <Field label="First serve" className="w-40">
            <Select
              ariaLabel="First serve"
              value={meta.firstServe ?? ""}
              onValueChange={(v) => onMeta({ firstServe: v === "us" || v === "them" ? v : null })}
              options={[
                { value: "", label: "Auto-detect" },
                { value: "us", label: names.us },
                { value: "them", label: names.them },
              ]}
            />
          </Field>
          <Field label="Start rotation" className="w-32">
            <Select
              ariaLabel="Start rotation"
              value={String(meta.startRotation)}
              onValueChange={(v) => onMeta({ startRotation: parseInt(v, 10) })}
              options={[1, 2, 3, 4, 5, 6].map((r) => ({ value: String(r), label: String(r) }))}
            />
          </Field>
        </div>
      )}
    </section>
  );
}
