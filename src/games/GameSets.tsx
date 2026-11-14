import type { JSX } from "react";
import { BarChart3, Plus, Trash2, Upload, Video } from "lucide-react";

import { ResultBadge } from "../stats/ResultBadge";
import { formatWhen } from "./format";
import type { SetSummary } from "../stats/types";
import type { Backup } from "../stats/sync/setSync";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Table, TableCell, TableHeadCell } from "../ui/Table";
import { CALLOUT_WARN, cx, MUTED, PANEL, PANEL_TITLE, TAG_CHIP, THEM_TEXT, US_TEXT } from "../ui/styles";
import { ExternalLink } from "../ui/ExternalLink";

type GameSetsProps = {
  sets: readonly SetSummary[];
  /** Sets with changes in this browser that the server does not have yet, by set id. */
  local: ReadonlyMap<string, Backup>;
  loading: boolean;
  /** Why the sets couldn't be loaded; those shown may then be out of date, so no set is started. */
  error: string | null;
  onReload: () => void;
  canEdit: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (set: SetSummary) => void;
  onImport: () => void;
  onStats: () => void;
};

/**
 * A game's recorded sets: the score of each from its saved stats, whether those hold its latest changes, and the
 * way into the tracker and the stats.
 */
export function GameSets({
  sets,
  local,
  loading,
  error,
  onReload,
  canEdit,
  onOpen,
  onNew,
  onDelete,
  onImport,
  onStats,
}: GameSetsProps): JSX.Element {
  // A set started in this browser that never reached the server is listed from its local copy.
  const onlyLocal = canEdit ? [...local].filter(([id]) => !sets.some((s) => s.id === id)) : [];
  const hasStats = sets.some((s) => s.statsSaved);

  return (
    <section className={cx(PANEL, "max-w-full")} aria-labelledby="sets-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 id="sets-title" className={PANEL_TITLE}>
            Sets
          </h2>
          {sets.length > 0 && <ResultBadge sets={sets} />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" paired={canEdit} onClick={onStats} disabled={!hasStats}>
            <BarChart3 size={15} aria-hidden="true" />
            Stats and highlights
          </Button>
          {canEdit && (
            <>
              <Button variant="ghost" paired onClick={onImport}>
                <Upload size={15} aria-hidden="true" />
                Import set files
              </Button>
              <Button onClick={onNew} disabled={loading || !!error}>
                <Plus size={15} aria-hidden="true" />
                {sets.length || onlyLocal.length ? "Next set" : "Start set 1"}
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className={cx(CALLOUT_WARN, "flex flex-wrap items-center justify-between gap-3")}>
          Couldn’t load the sets: {error}
          <Button variant="text" onClick={onReload}>
            Try again
          </Button>
        </p>
      )}
      {loading ? (
        <p className={MUTED}>Loading…</p>
      ) : error && sets.length === 0 && onlyLocal.length === 0 ? null : sets.length === 0 && onlyLocal.length === 0 ? (
        <p className={MUTED}>No sets recorded yet.</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <TableHeadCell className="w-20">Set</TableHeadCell>
              <TableHeadCell>Score</TableHeadCell>
              <TableHeadCell className="text-right max-sm:hidden">Touches</TableHeadCell>
              <TableHeadCell className="max-sm:hidden">Last saved</TableHeadCell>
              <TableHeadCell>Video</TableHeadCell>
              <TableHeadCell />
            </tr>
          </thead>
          <tbody>
            {sets.map((s) => (
              <tr key={s.id}>
                <TableCell className="font-semibold whitespace-nowrap">Set {s.setNumber || "?"}</TableCell>
                <TableCell className="tabular-nums">
                  {s.statsSaved ? (
                    <span className={cx("font-semibold", s.us > s.them ? US_TEXT : s.them > s.us ? THEM_TEXT : "")}>
                      {s.us}–{s.them}
                    </span>
                  ) : (
                    <span className="text-xs text-text-dim">No stats yet</span>
                  )}
                  {s.finished && <span className={cx(TAG_CHIP, "ml-2")}>Finished</span>}
                  {canEdit && s.unsavedStats && (
                    <span
                      className={cx(TAG_CHIP, "ml-2")}
                      title="Open the set and save its stats to show these changes"
                    >
                      {s.statsSaved ? "Stats not up to date" : "Stats not saved"}
                    </span>
                  )}
                  {local.has(s.id) && <span className={cx(TAG_CHIP, "ml-2 text-danger")}>Unsaved changes here</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums text-text-dim max-sm:hidden">{s.touches}</TableCell>
                <TableCell className="text-xs text-text-dim max-sm:hidden">
                  {formatWhen(s.updatedAt)}
                  {s.updatedBy && ` by ${s.updatedBy}`}
                </TableCell>
                <TableCell>
                  {s.videoUrl ? (
                    <ExternalLink href={s.videoUrl} className="inline-flex items-center gap-1">
                      <Video size={15} aria-hidden="true" /> Watch
                    </ExternalLink>
                  ) : (
                    <span className="text-xs text-text-dim">None</span>
                  )}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {canEdit && (
                    <>
                      <Button variant="text" onClick={() => onOpen(s.id)} aria-label={`Open set ${s.setNumber}`}>
                        Open
                      </Button>
                      <IconButton
                        variant="plain"
                        size="sm"
                        aria-label={`Delete set ${s.setNumber}`}
                        onClick={() => onDelete(s)}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </IconButton>
                    </>
                  )}
                </TableCell>
              </tr>
            ))}
            {onlyLocal.map(([id, backup]) => (
              <tr key={id}>
                <TableCell className="font-semibold whitespace-nowrap">
                  Set {backup.data.meta.setNumber || "?"}
                </TableCell>
                <TableCell colSpan={4}>
                  <span className={cx(TAG_CHIP, "text-danger")}>
                    Only in this browser: open it to save or discard it
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="text"
                    onClick={() => onOpen(id)}
                    aria-label={`Open set ${backup.data.meta.setNumber}`}
                  >
                    Open
                  </Button>
                </TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
}
