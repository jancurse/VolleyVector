import { useState } from "react";
import type { JSX } from "react";

import { stepMarkers } from "../boards/operations";
import type { Board } from "../boards/types";
import { Court } from "../court/Court";
import { IconButton } from "../ui/IconButton";
import { Input } from "../ui/Input";
import { cx, FIELD_LABEL, MUTED, PANEL_TITLE } from "../ui/styles";

// The editor for one board-group block. The block's ids are the note's board links themselves: the
// assigned boards show as ordered thumbnails with reorder and remove actions, and any board of the
// space can be added from the picker below, narrowed by a title filter. A board sits in at most one
// group per note, so boards held by another group of this note are not offered, and an assigned id
// that no longer resolves (deleted, or moved away) is dropped.
type BoardGroupBlockProps = {
  boardIds: readonly string[];
  /** Every board of the active space, newest first — all of them addable. */
  boards: readonly Board[];
  /** Board ids placed in other groups of this note, so this group never offers them. */
  reserved: ReadonlySet<string>;
  onChange: (boardIds: string[]) => void;
};

const CHIP = "m-0 flex w-[168px] flex-none flex-col overflow-hidden rounded-xl border border-border bg-panel text-left";
const THUMB = "aspect-square w-full border-b border-border bg-court-surface";
const CHIP_TITLE = "truncate px-2 pt-1.5 font-display text-sm font-bold tracking-[-0.01em]";

const MAX_OFFERED = 18;

export function BoardGroupBlock({ boardIds, boards, reserved, onChange }: BoardGroupBlockProps): JSX.Element {
  const [query, setQuery] = useState("");

  const byId = new Map(boards.map((b) => [b.id, b]));
  const assigned = boardIds.filter((id) => byId.has(id));
  const candidates = boards.filter((b) => !assigned.includes(b.id) && !reserved.has(b.id));
  const matching = candidates.filter((b) => b.title.toLowerCase().includes(query.trim().toLowerCase()));
  const offered = matching.slice(0, MAX_OFFERED);

  const move = (id: string, dir: -1 | 1) => {
    const index = assigned.indexOf(id);
    const swap = index + dir;

    if (swap < 0 || swap >= assigned.length) return;

    const next = [...assigned];

    [next[index], next[swap]] = [next[swap], next[index]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <span className={PANEL_TITLE}>Board group</span>

      {assigned.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {assigned.map((id, index) => {
            const board = byId.get(id)!;

            return (
              <figure key={id} className={CHIP}>
                <div className={THUMB} aria-hidden="true">
                  <Court markers={stepMarkers(board, 0)} label={board.title} compact />
                </div>
                <figcaption className={CHIP_TITLE}>{board.title || "Untitled board"}</figcaption>
                <div className="flex flex-wrap items-center gap-1 px-2 pt-1.5 pb-2">
                  <IconButton
                    variant="control"
                    size="xs"
                    aria-label={`Move ${board.title} up`}
                    disabled={index === 0}
                    onClick={() => move(id, -1)}
                  >
                    ↑
                  </IconButton>
                  <IconButton
                    variant="control"
                    size="xs"
                    aria-label={`Move ${board.title} down`}
                    disabled={index === assigned.length - 1}
                    onClick={() => move(id, 1)}
                  >
                    ↓
                  </IconButton>
                  <IconButton
                    variant="control"
                    size="xs"
                    aria-label={`Remove ${board.title} from group`}
                    onClick={() => onChange(assigned.filter((x) => x !== id))}
                  >
                    ✕
                  </IconButton>
                </div>
              </figure>
            );
          })}
        </div>
      )}

      {candidates.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className={FIELD_LABEL}>{assigned.length > 0 ? "Add another board" : "Pick boards"}</span>
          <div className="max-w-72">
            <Input
              value={query}
              placeholder="Filter boards…"
              aria-label="Filter boards"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            {offered.map((board) => (
              <button
                key={board.id}
                type="button"
                className={cx(
                  CHIP,
                  "group cursor-pointer transition-[transform,border-color] duration-150 ease-settle hover:-translate-y-[2px] hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                )}
                aria-label={`Add ${board.title || "Untitled board"}`}
                onClick={() => onChange([...assigned, board.id])}
              >
                <div className={THUMB} aria-hidden="true">
                  <Court markers={stepMarkers(board, 0)} label={board.title} compact />
                </div>
                <span className={CHIP_TITLE}>{board.title || "Untitled board"}</span>
                <span
                  className="px-2 pt-1 pb-2 font-mono text-2xs font-semibold uppercase tracking-[0.18em] text-text-dim group-hover:text-accent"
                  aria-hidden="true"
                >
                  + Add
                </span>
              </button>
            ))}
          </div>
          {matching.length > MAX_OFFERED && (
            <p className={MUTED}>
              Showing {MAX_OFFERED} of {matching.length} boards — type to narrow.
            </p>
          )}
          {matching.length === 0 && <p className={MUTED}>No boards match the filter.</p>}
        </div>
      ) : (
        assigned.length === 0 && <p className={MUTED}>No boards in this library yet.</p>
      )}
    </div>
  );
}
