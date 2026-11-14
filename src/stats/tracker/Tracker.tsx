import { lazy, Suspense, useEffect, useEffectEvent, useMemo, useReducer, useState } from "react";
import type { JSX, ReactNode } from "react";
import { Redo2, Undo2 } from "lucide-react";

import { GuideLink } from "../../guide/GuideLink";
import { Button } from "../../ui/Button";
import { useConfirm } from "../../ui/useConfirm";
import { cx, MUTED, PAGE_BAR, PAGE_WIDTH, TRACKER_GRID } from "../../ui/styles";
import {
  POINT_REASONS,
  predictSkill,
  resultLabel,
  resultsFor,
  SKILL_BY_KEY,
  touchOutcome,
  touchReasonsFor,
  ZONE_GRID,
} from "../codes";
import {
  clearLast,
  currentStep,
  draftFromTouch,
  draftToTouch,
  isComplete,
  newDraft,
  setField,
  toggleReason,
} from "../draft";
import type { Draft, Field } from "../draft";
import { download } from "../../bundle/download";
import { exportFilename, toCsv, toJson } from "../exporters";
import { deriveRallies, predictPlayer } from "../rallies";
import { toReportSet } from "../reportSet";
import { emptyData, initState, newId, nextSetData, parseImport, reducer } from "../store";
import type { AppData, MatchEvent, Rally, ReportSet, Skill, Team } from "../types";
import { FRAME, usePlayer } from "../usePlayer";
import { extractYoutubeId } from "../youtube";
import { EventLog } from "./EventLog";
import { Kbd } from "./Kbd";
import { LineupPanel } from "./LineupPanel";
import { PlayersPanel } from "./PlayersPanel";
import { Scoreboard } from "./Scoreboard";
import { SetPanel } from "./SetPanel";
import { ShortcutHelp } from "./ShortcutHelp";
import { StatEntry } from "./StatEntry";
import { RATES, VideoPanel } from "./VideoPanel";

// The stats and highlights load YouTube and are heavy; only load them when opened.
const StatsPage = lazy(() => import("../StatsPage").then((m) => ({ default: m.StatsPage })));

/** Stats are stamped slightly before the moment you press the key, to allow for reaction time. */
const STAT_LEAD = 1;
/** Marks are tapped right on the contact, so they need much less reaction-time allowance. */
const MARK_LEAD = 0.3;
/** A manual point this soon after a decisive touch is almost certainly a duplicate. */
const DOUBLE_POINT_WINDOW = 4;
const ZONES = new Set(ZONE_GRID.flat().filter(Boolean));

type TrackerProps = {
  /** The set as loaded. */
  initial: AppData;
  /** Our team's name and the opponent's, for the scoreboard. */
  names: { us: string; them: string };
  finished: boolean;
  /** Called with the set after every change, to be saved. */
  onChange: (data: AppData) => void;
  /** Start the next set of the game from `next` (same players, lineup, and video). */
  onNextSet: (next: AppData) => void;
  onFinish: (finished: boolean) => void;
  /** The left of the header: where this set belongs and whether it is saved. */
  header: ReactNode;
};

/** Recording one set from its video, by keyboard or by click. */
export function Tracker({
  initial,
  names,
  finished,
  onChange,
  onNextSet,
  onFinish,
  header,
}: TrackerProps): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initial, initState);
  const { data } = state;
  const [player, stage] = usePlayer(extractYoutubeId(initial.meta.youtubeUrl));
  const { confirm, dialog } = useConfirm();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [resumeAfterEntry, setResumeAfterEntry] = useState(false);
  // Contact marks tapped during play (Tab), described afterwards in a review pass.
  const [marks, setMarks] = useState<number[]>([]);
  const [review, setReview] = useState<{ returnTo: number; resume: boolean; total: number } | null>(null);
  // The sets shown in the stats and highlights or in the report: this one, or several loaded from files.
  const [statsView, setStatsView] = useState<ReportSet[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // A manual point that can still be given a reason with a single number key.
  const [pendingPoint, setPendingPoint] = useState<{ id: number; winner: Team } | null>(null);

  useEffect(() => onChange(data), [data, onChange]);

  useEffect(() => {
    if (!notice) return;

    const timer = setTimeout(() => setNotice(null), 6000);

    return () => clearTimeout(timer);
  }, [notice]);

  // The reason prompt is optional, so let it lapse rather than linger.
  useEffect(() => {
    if (!pendingPoint) return;

    const timer = setTimeout(() => setPendingPoint(null), 8000);

    return () => clearTimeout(timer);
  }, [pendingPoint]);

  const { firstServe, startRotation, lineup, libero } = data.meta;
  const rallyMeta = useMemo(
    () => ({ firstServe, startRotation, lineup, libero }),
    [firstServe, startRotation, lineup, libero]
  );
  const rallies = useMemo(() => deriveRallies(data.events, rallyMeta), [data.events, rallyMeta]);
  const openRally = rallies[rallies.length - 1];

  // Who was on court at the moment of the stat being entered (it may be an earlier mark).
  const draftTime = draft?.timestamp;
  const entryCourt = useMemo(() => {
    if (draftTime === undefined) return openRally.court;

    return (
      deriveRallies(
        data.events.filter((e) => e.timestamp <= draftTime),
        rallyMeta
      ).at(-1)?.court ?? null
    );
  }, [draftTime, data.events, rallyMeta, openRally]);

  const markers = useMemo(
    () =>
      data.events.map((e) => ({
        time: e.timestamp,
        tone: e.kind === "touch" ? touchOutcome(e) : e.kind === "point" ? e.winner : null,
      })),
    [data.events]
  );

  // --- Stat entry ----------------------------------------------------------

  const resume = () => {
    if (resumeAfterEntry) player.play();
    setResumeAfterEntry(false);
  };

  /** Start a new stat now, or at `at` (a marked contact) without touching playback. */
  const startEntry = (opts: { player?: string; stat?: Skill } = {}, at?: number) => {
    if (draft) return;

    setPendingPoint(null);

    if (at === undefined && marks.length && !review) {
      beginReview(opts);

      return;
    }

    if (at === undefined) {
      setResumeAfterEntry(player.isPlaying);
      player.pause();
    }

    const timestamp = at ?? Math.max(0, player.getTime() - STAT_LEAD);
    // Predict from what happened before this moment, so tagging an earlier point in the video still gets
    // sensible suggestions.
    const before = deriveRallies(
      data.events.filter((e) => e.timestamp <= timestamp),
      rallyMeta
    );
    const ctx = before[before.length - 1];
    const stat = opts.stat ?? predictSkill(ctx.touches[ctx.touches.length - 1] ?? null, ctx.serving);
    const who = opts.player ?? predictPlayer(before, stat);
    const d = newDraft(timestamp, who, stat);

    setDraft({ ...d, suggested: { player: d.suggested.player && !opts.player, stat: d.suggested.stat && !opts.stat } });
  };

  // --- Contact marks ---------------------------------------------------------

  const mark = () => {
    const t = Math.max(0, player.getTime() - MARK_LEAD);

    setMarks((m) => [...m, t].sort((a, b) => a - b));
  };

  /** Pause and walk through the marked contacts one at a time. */
  const beginReview = (opts: { player?: string; stat?: Skill } = {}) => {
    const first = marks[0];

    if (first === undefined) return;

    setReview({ returnTo: player.getTime(), resume: player.isPlaying, total: marks.length });
    player.pause();
    player.seek(first);
    startEntry(opts, first);
  };

  const finishReview = () => {
    if (!review) return;

    player.seek(review.returnTo);
    if (review.resume) player.play();
    setReview(null);
  };

  /** The current contact is done (described or skipped): move on to the next. */
  const advanceReview = (d: Draft) => {
    if (review && d.editingId === null) setMarks((m) => m.slice(1));
  };

  // Open the next contact once the previous one is saved, so its predictions already include the stat
  // just entered. Held while a just-recorded point is waiting for its optional reason.
  const nextContact = useEffectEvent(() => {
    if (!review || draft || pendingPoint) return;

    const next = marks[0];

    if (next === undefined) return finishReview();

    player.seek(next);
    startEntry({}, next);
  });

  useEffect(() => {
    // After this render settles, so the stat just entered is in the data the next one predicts from.
    const timer = setTimeout(() => nextContact(), 0);

    return () => clearTimeout(timer);
  }, [review, draft, marks, pendingPoint]);

  const commit = (d: Draft) => {
    if (!isComplete(d)) return;

    advanceReview(d);
    dispatch({
      type: d.editingId !== null ? "updateEvent" : "addEvent",
      event: draftToTouch(d, d.editingId ?? newId(data.events)),
    });
    setDraft(null);
    resume();
  };

  const change = (field: Field, value: string) => {
    if (!draft) return;

    const next = setField(draft, field, value);

    // New stats save themselves as soon as the last field is filled in.
    if (next.editingId === null && next.stat !== "misc" && isComplete(next)) commit(next);
    else setDraft(next);
  };

  /** Esc: drop this stat. While reviewing, that also discards the contact mark. */
  const cancel = () => {
    if (draft) advanceReview(draft);
    setDraft(null);
    resume();
  };

  const clearMarks = () => {
    setMarks([]);

    if (review) {
      setDraft(null);
      finishReview();
    }
  };

  const recordPoint = (winner: Team, reason?: string) => {
    // While describing marks, a point means the current mark was the opponent's contact (e.g. their attack
    // out): the point takes that mark's place and time.
    const markAt = review && draft?.editingId === null ? draft.timestamp : undefined;

    setDraft(null);

    // Guard against double-recording: a decisive touch already ended this rally.
    const prev = rallies[rallies.length - 2];
    const now = markAt ?? (review ? review.returnTo : player.getTime());

    if (
      openRally.touches.length === 0 &&
      prev?.endedBy?.kind === "touch" &&
      Math.abs(now - prev.endTime) < DOUBLE_POINT_WINDOW
    ) {
      const t = prev.endedBy;

      setNotice(
        `Not added: rally ${prev.index} already ended on ${t.player}’s ${t.stat} (${resultLabel(t.stat, t.result)}).`
      );

      return;
    }

    const id = newId(data.events);

    dispatch({ type: "addEvent", event: { kind: "point", id, timestamp: now, winner, ...(reason && { reason }) } });
    if (markAt !== undefined) setMarks((m) => m.slice(1));
    setPendingPoint(reason ? null : { id, winner });
    resume();
  };

  /** Give an inferred rally end an explicit reason, e.g. "opponent attack error". */
  const annotateRally = (r: Rally, reason: string) => {
    if (!r.winner) return;

    // Place the point right after the rally's last touch (or the previous rally's end, for a rally with no
    // touches) so it closes the same rally.
    const after = r.touches.length ? r.endTime : (rallies[r.index - 2]?.endTime ?? 0);

    dispatch({
      type: "addEvent",
      event: { kind: "point", id: newId(data.events), timestamp: after + 0.01, winner: r.winner, reason },
    });
  };

  const setPointReason = (reason: string) => {
    const e = pendingPoint && data.events.find((ev) => ev.id === pendingPoint.id);

    if (e?.kind === "point") dispatch({ type: "updateEvent", event: { ...e, reason } });
    setPendingPoint(null);
  };

  const editEvent = (e: MatchEvent) => {
    if (e.kind === "point") {
      setDraft(null);
      setPendingPoint({ id: e.id, winner: e.winner });

      return;
    }

    // A sub has nothing to edit: delete and redo it instead.
    if (e.kind === "sub") return;

    setResumeAfterEntry(false);
    setDraft(draftFromTouch(e));
  };

  // --- Keyboard ------------------------------------------------------------

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    // The stats view is a full-screen overlay: only Escape (to close it) reaches the tracker.
    if (statsView) {
      if (e.key === "Escape") setStatsView(null);

      return;
    }

    const t = e.target as HTMLElement;
    const typing =
      (t.tagName === "INPUT" && (t as HTMLInputElement).type !== "range") ||
      t.tagName === "TEXTAREA" ||
      t.tagName === "SELECT" ||
      t.isContentEditable ||
      // A dialog or an open select popup owns its keys.
      !!t.closest?.("[role=dialog],[role=alertdialog],[role=listbox]");

    if (typing) return;

    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      dispatch({ type: e.shiftKey ? "redo" : "undo" });

      return;
    }

    if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      dispatch({ type: "redo" });

      return;
    }

    if (mod || e.altKey) return;

    const digit = /^(?:Digit|Numpad)(\d)$/.exec(e.code)?.[1];

    // Right after a manual point, a number key picks its reason; anything else dismisses the prompt.
    if (pendingPoint) {
      const reason = digit && !e.shiftKey ? POINT_REASONS[pendingPoint.winner][Number(digit) - 1] : undefined;

      if (reason) {
        e.preventDefault();
        setPointReason(reason.id);

        return;
      }

      setPendingPoint(null);

      // In a review the next contact opens by itself, so the dismissing key must not start a stat of its own.
      if (e.key === "Escape" || review) {
        e.preventDefault();

        return;
      }
    }

    if (digit !== undefined) {
      e.preventDefault();

      const playerAt = data.players[digit === "0" ? 9 : Number(digit) - 1];

      if (!draft || e.shiftKey) {
        if (!playerAt) return;
        if (draft) change("player", playerAt);
        else startEntry({ player: playerAt });

        return;
      }

      const step = currentStep(draft);

      if (step === "player" && playerAt) change("player", playerAt);

      if (step === "result") {
        const r = resultsFor(draft.stat)[Number(digit) - 1];

        if (r) change("result", r.id);
      }

      if (step === "zone" && ZONES.has(digit)) change("zone", digit);

      return;
    }

    const touchReason = draft && touchReasonsFor(draft.stat, draft.result).find((r) => r.key === e.key.toLowerCase());

    if (touchReason) {
      e.preventDefault();
      setDraft(toggleReason(draft, touchReason.id));

      return;
    }

    const skill = SKILL_BY_KEY[e.key.toLowerCase()];

    if (skill && !e.shiftKey) {
      e.preventDefault();
      if (draft) change("stat", skill);
      else startEntry({ stat: skill });

      return;
    }

    const handled = () => e.preventDefault();

    switch (e.key) {
      case "Tab":
        handled();
        if (!draft && !review) mark();
        break;
      case " ":
        handled();
        player.toggle();
        break;
      case "ArrowLeft":
        handled();
        player.seekBy(e.shiftKey ? -5 : -2);
        break;
      case "ArrowRight":
        handled();
        player.seekBy(e.shiftKey ? 5 : 2);
        break;
      case ",":
        handled();
        player.pause();
        player.seekBy(-FRAME);
        break;
      case ".":
        handled();
        player.pause();
        player.seekBy(FRAME);
        break;
      case "[":
      case "]": {
        handled();

        const i = RATES.indexOf(player.rate);
        const next = RATES[Math.min(Math.max((i < 0 ? 3 : i) + (e.key === "]" ? 1 : -1), 0), RATES.length - 1)];

        player.setRate(next);
        break;
      }
      case "+":
      case "=":
        handled();
        recordPoint("us");
        break;
      case "-":
      case "_":
        handled();
        recordPoint("them");
        break;
      case "Enter":
        handled();
        if (draft) commit(draft);
        else startEntry();
        break;
      case "Escape":
        if (draft) cancel();
        break;
      case "Backspace":
        if (draft) {
          handled();
          setDraft(clearLast(draft));
        }

        break;
    }
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e);

    // Capture phase on window, so no focused element can swallow a shortcut first.
    window.addEventListener("keydown", h, { capture: true });

    return () => window.removeEventListener("keydown", h, { capture: true });
  }, []);

  // --- Data management -----------------------------------------------------

  const exportAs = (format: "json" | "csv") => {
    if (format === "json") download(toJson(data, rallies), exportFilename(data, "json"), "application/json");
    else download(toCsv(rallies), exportFilename(data, "csv"), "text/csv");
  };

  const importFile = async (file: File) => {
    let imported: AppData;

    try {
      imported = parseImport(JSON.parse(await file.text()));
    } catch (err) {
      void confirm({
        title: `Couldn’t import ${file.name}`,
        description: err instanceof Error ? err.message : String(err),
        confirmLabel: "OK",
      });

      return;
    }

    if (
      (data.events.length || data.players.length || data.meta.lineup.length) &&
      !(await confirm({
        title: "Replace this set’s stats with the file?",
        description: "You can undo with Ctrl+Z until you leave the page.",
        confirmLabel: "Replace",
      }))
    )
      return;

    setDraft(null);
    // The game's teams and date stay, and the set's number when the file has none; the rest is the file's.
    const { homeTeam, awayTeam, date, setNumber } = data.meta;

    dispatch({
      type: "replace",
      data: {
        ...imported,
        meta: { ...imported.meta, homeTeam, awayTeam, date, setNumber: imported.meta.setNumber || setNumber },
      },
    });

    const id = extractYoutubeId(imported.meta.youtubeUrl);

    if (id && player.source?.type !== "file") player.loadYoutube(id);
  };

  /** Sets from several exported set files, plus (if asked) the one being tracked, in set order. */
  const statsFromFiles = async (files: File[]) => {
    const sets: ReportSet[] = [];
    const failed: string[] = [];

    for (const file of files) {
      try {
        sets.push(toReportSet(parseImport(JSON.parse(await file.text()))));
      } catch {
        failed.push(file.name);
      }
    }

    if (failed.length)
      await confirm({
        title: "Some files were skipped",
        description: `Not set exports: ${failed.join(", ")}`,
        confirmLabel: "OK",
      });

    const uploaded = new Set(sets.map((s) => s.meta.setNumber).filter(Boolean));

    if (
      data.events.length &&
      !(data.meta.setNumber && uploaded.has(data.meta.setNumber)) &&
      (await confirm({
        title: `Include the set you’re tracking${data.meta.setNumber ? ` (set ${data.meta.setNumber})` : ""}?`,
        confirmLabel: "Include",
        cancelLabel: "Leave out",
      }))
    )
      sets.push({ meta: data.meta, rallies });

    if (!sets.length) return;

    sets.sort((a, b) => (parseInt(a.meta.setNumber, 10) || 0) - (parseInt(b.meta.setNumber, 10) || 0));
    player.pause();
    setStatsView(sets);
  };

  const nextSet = async () => {
    if (
      !(await confirm({
        title: "Start the next set?",
        description: "Players, lineup, and video are kept.",
        confirmLabel: "Start",
      }))
    )
      return;

    setDraft(null);
    onNextSet(nextSetData(data));
  };

  const clearAll = async () => {
    const ok = await confirm({
      title: "Clear this set’s stats and players?",
      description: "You can undo with Ctrl+Z until you leave the page.",
      confirmLabel: "Clear",
      danger: true,
    });

    if (!ok) return;

    setDraft(null);
    dispatch({ type: "replace", data: { ...emptyData(), meta: { ...data.meta, lineup: [], libero: "" } } });
  };

  return (
    <div className={cx("mx-auto flex flex-col gap-4", PAGE_WIDTH)}>
      {statsView && (
        <Suspense fallback={<p className={MUTED}>Loading the stats…</p>}>
          <StatsPage
            sets={statsView}
            eyebrow={statsView.length === 1 && statsView[0].meta === data.meta ? "This set" : "Set files"}
            title={names.us && names.them ? `${names.us} vs ${names.them}` : "Stats"}
            initialTab="stats"
            back={{ label: "Back to the set", onBack: () => setStatsView(null) }}
          />
        </Suspense>
      )}
      {/* The tracker stays mounted under the stats, so the video and the entry in progress are where they were. */}
      <div hidden={!!statsView} className="flex flex-col gap-4">
        <header className={PAGE_BAR}>
          {header}
          <div className="flex items-center gap-1">
            <GuideLink topic="record" />
            <Button variant="text" onClick={() => dispatch({ type: "undo" })} disabled={!state.past.length}>
              <Undo2 size={15} aria-hidden="true" /> Undo <Kbd>Ctrl+Z</Kbd>
            </Button>
            <Button variant="text" onClick={() => dispatch({ type: "redo" })} disabled={!state.future.length}>
              <Redo2 size={15} aria-hidden="true" /> Redo <Kbd>Ctrl+⇧+Z</Kbd>
            </Button>
          </div>
        </header>

        {/* On a narrow screen the entry comes straight after the video, and the log after both. */}
        <div className={TRACKER_GRID}>
          <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1">
            <VideoPanel
              player={player}
              stage={stage}
              youtubeUrl={data.meta.youtubeUrl}
              onYoutubeUrl={(youtubeUrl) => dispatch({ type: "setMeta", meta: { youtubeUrl } })}
              markers={markers}
              marks={marks}
              onMark={mark}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <Scoreboard
              rally={openRally}
              meta={data.meta}
              names={names}
              hasEvents={data.events.length > 0}
              pending={pendingPoint}
              notice={notice}
              onPoint={recordPoint}
              onReason={setPointReason}
              onMeta={(meta) => dispatch({ type: "setMeta", meta })}
            />
            <StatEntry
              draft={draft}
              players={data.players}
              onStart={(opts) => startEntry(opts)}
              onChange={change}
              onReason={(reason) => draft && setDraft(toggleReason(draft, reason))}
              onSave={() => draft && commit(draft)}
              onCancel={cancel}
              marks={marks.length}
              review={review && { index: review.total - marks.length + 1, total: review.total }}
              onClearMarks={clearMarks}
              court={entryCourt}
            />
            <LineupPanel
              court={openRally.court}
              serving={openRally.serving}
              players={data.players}
              lineup={data.meta.lineup}
              libero={data.meta.libero}
              onSetLineup={(l, lib) => dispatch({ type: "setLineup", lineup: l, libero: lib })}
              onSub={(out, inn) =>
                dispatch({
                  type: "addEvent",
                  event: {
                    kind: "sub",
                    id: newId(data.events),
                    timestamp: review ? review.returnTo : player.getTime(),
                    out,
                    in: inn,
                  },
                })
              }
            />
            <PlayersPanel
              players={data.players}
              onAdd={(name) => dispatch({ type: "addPlayer", name })}
              onRemove={(name) => dispatch({ type: "removePlayer", name })}
              onMove={(name, delta) => dispatch({ type: "movePlayer", name, delta })}
            />
            <SetPanel
              meta={data.meta}
              hasEvents={data.events.length > 0}
              finished={finished}
              onMeta={(meta) => dispatch({ type: "setMeta", meta })}
              onExport={exportAs}
              onStats={() => {
                player.pause();
                setStatsView([{ meta: data.meta, rallies }]);
              }}
              onImport={(file) => void importFile(file)}
              onStatsFromFiles={(files) => void statsFromFiles(files)}
              onNextSet={() => void nextSet()}
              onFinish={onFinish}
              onClear={() => void clearAll()}
            />
            <ShortcutHelp />
          </div>

          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <EventLog
              rallies={rallies}
              currentTime={player.currentTime}
              editingId={draft?.editingId ?? null}
              onSeek={player.seek}
              onEdit={editEvent}
              onDelete={(id) => dispatch({ type: "deleteEvent", id })}
              onAnnotate={annotateRally}
            />
          </div>
        </div>
      </div>
      {dialog}
    </div>
  );
}
