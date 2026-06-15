import type { JSX } from "react";

import { Button } from "../ui/Button";
import { MUTED, PANEL, PANEL_TITLE, cx } from "../ui/styles";

// The history list: one selectable row per revision, newest first, each showing its change summary, author,
// and time. The current revision is marked, and a past revision offers Restore to an editor (restoring
// commits its content as a new revision rather than rewinding).

export type RevisionRow = {
  id: string;
  summary: string;
  authorName: string | null;
  createdAt: number;
};

type RevisionListProps = {
  revisions: readonly RevisionRow[];
  selectedId: string | null;
  currentId: string | null;
  onSelect: (id: string) => void;
  /** Restore a past revision; absent when the viewer may not edit the content. */
  onRestore?: (id: string) => void;
  loading: boolean;
  error: string | null;
};

const ROW_BASE =
  "w-full rounded-md border px-3 py-2.5 text-left transition-colors duration-150 ease-settle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function RevisionList({
  revisions,
  selectedId,
  currentId,
  onSelect,
  onRestore,
  loading,
  error,
}: RevisionListProps): JSX.Element {
  return (
    <aside className={cx(PANEL, "flex flex-col gap-3")} aria-label="Revision history">
      <span className={PANEL_TITLE}>Revision history</span>
      {loading && <p className={MUTED}>Loading…</p>}
      {error && <p className="m-0 text-sm font-semibold text-danger">{error}</p>}
      {!loading && !error && revisions.length === 0 && <p className={MUTED}>No revisions yet.</p>}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {revisions.map((rev) => {
          const current = rev.id === currentId;
          const selected = rev.id === selectedId;

          return (
            <li key={rev.id} className="flex flex-col gap-1.5">
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(rev.id)}
                className={cx(
                  ROW_BASE,
                  selected
                    ? "border-accent bg-control-hover text-text"
                    : "border-border bg-control text-text-dim hover:bg-control-hover hover:text-text"
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-ui text-sm font-semibold text-text">{rev.summary}</span>
                  {current && <span className={cx(PANEL_TITLE, "text-accent")}>Current</span>}
                </span>
                <span className="mt-0.5 block font-mono text-xs text-text-dim">
                  {formatTime(rev.createdAt)}
                  {rev.authorName ? ` · ${rev.authorName}` : ""}
                </span>
              </button>
              {onRestore && !current && (
                <Button variant="text" size="sm" className="self-start" onClick={() => onRestore(rev.id)}>
                  Restore this version
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
