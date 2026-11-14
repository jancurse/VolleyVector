import { useState } from "react";
import type { JSX } from "react";
import { Check, Plus, Trash2, Upload, Video, X } from "lucide-react";

import { youtubeAt } from "../stats/clips";
import { ResultBadge } from "../stats/ResultBadge";
import { extractYoutubeId } from "../stats/youtube";
import { formatWhen } from "./format";
import type { AppData, SetSummary } from "../stats/types";
import type { Backup } from "../stats/sync/setSync";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Input } from "../ui/Input";
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
  /** The sets' full data by id, once loaded. */
  data: ReadonlyMap<string, AppData> | undefined;
  canEdit: boolean;
  /** Open a set in the tracker. */
  onOpen: (id: string) => void;
  /** Add the next set; resolves once it is a row. */
  onNew: () => Promise<void>;
  onDelete: (set: SetSummary) => void;
  onImport: () => void;
  /** Type in a set's score; resolves to an error, or null once saved. */
  onScore: (set: SetSummary, score: Score) => Promise<string | null>;
};

type Score = { us: number; them: number };

/** Seconds of video kept before a set's first action, so the link opens just before play starts. */
const LEAD_IN = 5;

/** A set's video link, starting just before its first action. */
function videoLink(url: string, data: AppData | undefined): string {
  const id = extractYoutubeId(url);

  if (!id || !data?.events.length) return url;

  return youtubeAt(id, Math.min(...data.events.map((e) => e.timestamp)) - LEAD_IN);
}

const points = (value: string): number | null => (/^\d{1,2}$/.test(value.trim()) ? Number(value) : null);

/** A set's score, which a coach clicks to type in: for a set without stats, or one whose stats are incomplete. */
function ScoreCell({
  set,
  typed,
  canEdit,
  onSave,
}: {
  set: SetSummary;
  /** Whether the score is typed in over the set's recorded stats. */
  typed: boolean;
  canEdit: boolean;
  onSave: (score: Score) => Promise<string | null>;
}): JSX.Element {
  const [draft, setDraft] = useState<{ us: string; them: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const score = set.statsSaved ? (
    <span className={cx("font-semibold", set.us > set.them ? US_TEXT : set.them > set.us ? THEM_TEXT : "")}>
      {set.us}–{set.them}
    </span>
  ) : (
    <span className="text-xs text-text-dim">No stats yet</span>
  );

  if (!draft) {
    return canEdit ? (
      <button
        type="button"
        className="-mx-1.5 cursor-text rounded-sm px-1.5 py-0.5 tabular-nums transition-colors hover:bg-control"
        aria-label={`Edit the score of set ${set.setNumber}`}
        title="Type in the score"
        onClick={() => setDraft({ us: String(set.us), them: String(set.them) })}
      >
        {score}
        {typed && (
          <span className="ml-1 text-text-dim" title="Typed in over the recorded stats">
            *
          </span>
        )}
      </button>
    ) : (
      score
    );
  }

  const us = points(draft.us);
  const them = points(draft.them);
  const cancel = () => {
    setDraft(null);
    setError(null);
  };

  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (us === null || them === null) return;
        setSaving(true);
        void onSave({ us, them }).then((failed) => {
          setSaving(false);
          if (failed) setError(failed);
          else cancel();
        });
      }}
      onKeyDown={(e) => e.key === "Escape" && cancel()}
    >
      <div className="flex items-center gap-1">
        <Input
          className="w-12 px-1.5 py-1 text-center"
          inputMode="numeric"
          aria-label={`Our points in set ${set.setNumber}`}
          value={draft.us}
          onChange={(e) => setDraft({ ...draft, us: e.target.value })}
          onFocus={(e) => e.target.select()}
          autoFocus
        />
        –
        <Input
          className="w-12 px-1.5 py-1 text-center"
          inputMode="numeric"
          aria-label={`Their points in set ${set.setNumber}`}
          value={draft.them}
          onChange={(e) => setDraft({ ...draft, them: e.target.value })}
          onFocus={(e) => e.target.select()}
        />
        <IconButton
          type="submit"
          variant="plain"
          size="sm"
          aria-label="Save the score"
          disabled={saving || us === null || them === null}
        >
          <Check size={14} aria-hidden="true" />
        </IconButton>
        <IconButton variant="plain" size="sm" aria-label="Cancel" onClick={cancel}>
          <X size={14} aria-hidden="true" />
        </IconButton>
      </div>
      {error && <p className="m-0 text-xs text-danger">{error}</p>}
    </form>
  );
}

/**
 * A game's recorded sets: the score of each from its saved stats, which a coach may type in, whether those hold its
 * latest changes, and the way into the tracker.
 */
export function GameSets({
  sets,
  local,
  loading,
  error,
  onReload,
  data,
  canEdit,
  onOpen,
  onNew,
  onDelete,
  onImport,
  onScore,
}: GameSetsProps): JSX.Element {
  // A set started in this browser that never reached the server is listed from its local copy.
  const onlyLocal = canEdit ? [...local].filter(([id]) => !sets.some((s) => s.id === id)) : [];
  const [adding, setAdding] = useState(false);

  return (
    <section className={cx(PANEL, "max-w-full min-w-[min(100%,32rem)]")} aria-labelledby="sets-title">
      {/* The header wraps within the table's width rather than widening the panel. */}
      <div className="flex flex-wrap items-center justify-between gap-3 [contain:inline-size]">
        <div className="flex items-center gap-2">
          <h2 id="sets-title" className={PANEL_TITLE}>
            Sets
          </h2>
          {sets.length > 0 && <ResultBadge sets={sets} />}
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" paired onClick={onImport}>
              <Upload size={15} aria-hidden="true" />
              Import set files
            </Button>
            <Button
              onClick={() => {
                setAdding(true);
                void onNew().finally(() => setAdding(false));
              }}
              disabled={loading || adding || !!error}
            >
              <Plus size={15} aria-hidden="true" />
              Add set
            </Button>
          </div>
        )}
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
                  <ScoreCell
                    set={s}
                    typed={!!data?.get(s.id)?.meta.score && !!data.get(s.id)?.events.length}
                    canEdit={canEdit}
                    onSave={(score) => onScore(s, score)}
                  />
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
                    <ExternalLink
                      href={videoLink(s.videoUrl, data?.get(s.id))}
                      className="inline-flex items-center gap-1"
                    >
                      <Video size={15} aria-hidden="true" /> Watch
                    </ExternalLink>
                  ) : (
                    <span className="text-xs text-text-dim">None</span>
                  )}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {canEdit && (
                    <>
                      <Button
                        variant="text"
                        onClick={() => onOpen(s.id)}
                        aria-label={`Record stats for set ${s.setNumber}`}
                      >
                        Record stats
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
                    aria-label={`Record stats for set ${backup.data.meta.setNumber}`}
                  >
                    Record stats
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
