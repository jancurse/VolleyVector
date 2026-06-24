import type { JSX } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "../ui/Button";
import { MUTED, PANEL, PANEL_TITLE, cx } from "../ui/styles";

// The history list: one selectable row per revision, newest first, each showing its change summary, author,
// and time. The current revision is marked, and the selected past revision offers Restore inside its row (to
// an editor; restoring commits its content as a new revision rather than rewinding). When the surrounding
// history layout stacks (≤900px), the list is a collapsible disclosure so the preview sits right below its
// summary; when two-column (≥901px) it shows in full with no affordance, matching the wide layout.

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

const CARD_BASE = "rounded-md border transition-colors duration-150 ease-settle";

const ROW_BUTTON =
  "block w-full rounded-md px-3 py-2.5 text-left outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";

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
    <aside aria-label="Revision history">
      <details className={cx(PANEL, "group gap-3", "min-[901px]:[&::details-content]:[content-visibility:visible]")}>
        <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden min-[901px]:cursor-default">
          <span className={PANEL_TITLE}>Revision history</span>
          <span className="font-mono text-xs text-text-dim min-[901px]:hidden">
            {revisions.length} revision{revisions.length === 1 ? "" : "s"}
          </span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="ml-auto text-text-dim transition-transform duration-150 ease-settle group-open:rotate-180 min-[901px]:hidden"
          />
        </summary>
        <div className="flex flex-col gap-3">
          {loading && <p className={MUTED}>Loading…</p>}
          {error && <p className="m-0 text-sm font-semibold text-danger">{error}</p>}
          {!loading && !error && revisions.length === 0 && <p className={MUTED}>No revisions yet.</p>}
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {revisions.map((rev) => {
              const current = rev.id === currentId;
              const selected = rev.id === selectedId;

              return (
                <li
                  key={rev.id}
                  className={cx(
                    CARD_BASE,
                    selected ? "border-accent bg-control-hover" : "border-border bg-control hover:bg-control-hover"
                  )}
                >
                  <button type="button" aria-pressed={selected} onClick={() => onSelect(rev.id)} className={ROW_BUTTON}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-ui text-sm font-semibold text-text">{rev.summary}</span>
                      {current && <span className={cx(PANEL_TITLE, "text-accent")}>Current</span>}
                    </span>
                    <span className="mt-0.5 block font-mono text-xs text-text-dim">
                      {formatTime(rev.createdAt)}
                      {rev.authorName ? ` · ${rev.authorName}` : ""}
                    </span>
                  </button>
                  {onRestore && selected && !current && (
                    <div className="border-t border-border px-3 py-2">
                      <Button variant="text" size="sm" onClick={() => onRestore(rev.id)}>
                        Restore this version
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </details>
    </aside>
  );
}
