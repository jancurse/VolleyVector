import { lazy, Suspense, useEffect, useEffectEvent, useMemo, useReducer, useState } from "react";
import type { JSX, ReactNode } from "react";
import { Check, Lock, Maximize2, Minimize2, PanelBottom, PanelRight, Redo2, Undo2 } from "lucide-react";

import { GuideLink } from "../../guide/GuideLink";
import { Button } from "../../ui/Button";
import { IconButton } from "../../ui/IconButton";
import { useConfirm } from "../../ui/useConfirm";
import { MUTED, STATUS_NOTE, TRACKER_BAR, TRACKER_WORKSPACE } from "../../ui/styles";
import {
  POINT_REASONS,
  predictSkill,
  predictType,
  resultLabel,
  resultsFor,
  SKILL_BY_KEY,
  touchOutcome,
  touchReasonsFor,
  typesFor,
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
  setType,
  toggleReason,
} from "../draft";
import type { Draft, Field } from "../draft";
import { download } from "../../bundle/download";
import { exportFilename, toCsv, toJson } from "../exporters";
import { deriveRallies, predictPlayer } from "../rallies";
import { toReportSet } from "../reportSet";
import { isTyping } from "../typing";
import { emptyData, initState, newId, nextSetData, parseImport, reducer } from "../store";
import type { Action } from "../store";
import type { AppData, MatchEvent, Rally, ReportSet, Skill, Team } from "../types";
import { FRAME, usePlayer } from "../usePlayer";
import { extractYoutubeId } from "../youtube";
import { EventLog } from "./EventLog";
import { PlayersDialog } from "./PlayersDialog";
import { Scoreboard } from "./Scoreboard";
import { SetMenu } from "./SetMenu";
import { ShortcutHelp } from "./ShortcutHelp";
import { StatEntry } from "./StatEntry";
import { initialArrangement, saveArrangement, TrackerPanes } from "./TrackerPanes";
import type { Arrangement } from "./TrackerPanes";
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
/** The keys a locked set still answers: the video's, focus mode, and the arrangement. */
const VIEW_KEYS = new Set([" ", "ArrowLeft", "ArrowRight", ",", ".", "[", "]", "v", "V", "x", "X"]);

type TrackerProps = {
  /** The set as loaded. */
  initial: AppData;
  /** Our team's name and the opponent's, for the scoreboard. */
  names: { us: string; them: string };
  /** Whether the app's sidebar and top bar are hidden, and how to switch that; absent where there are none. */
  focus?: boolean;
  onFocus?: (focus: boolean) => void;
  /** Lay the tracker out as resizable panes filling the window; without it, as a plain stacked page. */
  panes?: boolean;
  /** Whether the team's stats lack changes the set already holds, so Done has something to publish. */
  statsBehind?: boolean;
  /** Called with the set after every change, to be saved. */
  onChange: (data: AppData) => void;
  /** Start the next set of the game from `next` (same players and video). */
  onNextSet: (next: AppData) => void;
  /**
   * Put the set's changes in the team's stats and mark it finished (true), or take it back into editing (false).
   * Resolves to whether that worked.
   */
  onFinish: (finished: boolean) => Promise<boolean>;
  /** The left of the header: where this set belongs and whether it is saved. */
  header: ReactNode;
};

/** Recording one set from its video, by keyboard or by click. */
export function Tracker({
  initial,
  names,
  focus = false,
  onFocus,
  panes = false,
  statsBehind = false,
  onChange,
  onNextSet,
  onFinish,
  header,
}: TrackerProps): JSX.Element {
  const [state, apply] = useReducer(reducer, initial, initState);
  const { data } = state;
  const detailed = !!data.meta.detailed;
  // A set with stats opens locked, so nothing changes it by accident: it plays and shows its stats, and changes
  // only between Edit set and Done.
  const [editing, setEditing] = useState(initial.events.length === 0);
  const [switching, setSwitching] = useState(false);
  const locked = !editing;
  // Nothing changes a locked set, whichever control or key asks, nor one on its way to being locked.
  const dispatch = (action: Action) => {
    if (!locked && !switching) apply(action);
  };
  const switchEditing = async (on: boolean) => {
    setSwitching(true);
    try {
      if (await onFinish(!on)) setEditing(on);
    } finally {
      setSwitching(false);
    }
  };
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
  const [playersOpen, setPlayersOpen] = useState(false);
  const [arrangement, setArrangement] = useState<Arrangement>(initialArrangement);
  const flip = () => {
    const next = arrangement === "beside" ? "below" : "beside";

    setArrangement(next);
    saveArrangement(next);
  };

  // Locking the set drops whatever was still being entered.
  if (locked && (draft || pendingPoint || marks.length || review || playersOpen)) {
    setDraft(null);
    setPendingPoint(null);
    setMarks([]);
    setReview(null);
    setPlayersOpen(false);
  }

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
  const startEntry = (opts: { player?: string; stat?: Skill; type?: string } = {}, at?: number) => {
    if (draft || locked) return;

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
    const last = ctx.touches[ctx.touches.length - 1] ?? null;
    const stat = opts.stat ?? predictSkill(last, ctx.serving);
    const who = opts.player ?? predictPlayer(before, stat);
    const d = newDraft(timestamp, who, stat, detailed);

    setDraft({
      ...d,
      type: opts.type ?? predictType(last, stat, detailed),
      suggested: { player: d.suggested.player && !opts.player, stat: d.suggested.stat && !opts.stat },
    });
  };

  // --- Contact marks ---------------------------------------------------------

  const mark = () => {
    if (locked) return;

    const t = Math.max(0, player.getTime() - MARK_LEAD);

    setMarks((m) => [...m, t].sort((a, b) => a - b));
  };

  /** Pause and walk through the marked contacts one at a time. */
  const beginReview = (opts: { player?: string; stat?: Skill; type?: string } = {}) => {
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

    const next = setField(draft, field, value, detailed);

    // New stats save themselves as soon as the last field is filled in.
    if (next.editingId === null && next.stat !== "misc" && isComplete(next)) commit(next);
    else setDraft(next);
  };

  /** Move the stat being edited in time, and show that moment. */
  const retime = (to: number | "video") => {
    if (!draft) return;

    const timestamp = Math.max(0, to === "video" ? player.getTime() : draft.timestamp + to);

    setDraft({ ...draft, timestamp });
    if (to !== "video") player.seek(timestamp);
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
      if (e.key === "Escape" && !isTyping(e.target)) setStatsView(null);

      return;
    }

    if (isTyping(e.target)) return;
    if (locked && !VIEW_KEYS.has(e.key)) return;

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
        const r = resultsFor(draft.stat, detailed)[Number(digit) - 1];

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

    // A kind of attack or defense, once that skill is picked. T is a tip whatever the skill so far.
    const type = !e.shiftKey && typesFor(draft?.stat ?? "", detailed).find((t) => t.key === e.key.toLowerCase());

    if (draft && type) {
      e.preventDefault();
      setDraft(setType(draft, type.id, detailed));

      return;
    }

    if (detailed && !e.shiftKey && e.key.toLowerCase() === "t") {
      e.preventDefault();
      if (draft) setDraft(setType(setField(draft, "stat", "attack", detailed), "tip", detailed));
      else startEntry({ stat: "attack", type: "tip" });

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
      case "v":
      case "V":
        if (onFocus) {
          handled();
          onFocus(!focus);
        }

        break;
      case "x":
      case "X":
        if (panes) {
          handled();
          flip();
        }

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
        description:
          "Players and video are kept. The lineup starts from the game’s first rotation, or else from this set’s.",
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

  const video = (
    <VideoPanel
      player={player}
      stage={stage}
      youtubeUrl={data.meta.youtubeUrl}
      onYoutubeUrl={(youtubeUrl) => dispatch({ type: "setMeta", meta: { youtubeUrl } })}
      markers={markers}
      marks={marks}
      onMark={mark}
      locked={locked}
      fill={panes}
    />
  );
  const actions = (
    <StatEntry
      draft={draft}
      players={data.players}
      onStart={(opts) => startEntry(opts)}
      onChange={change}
      onType={(type) => draft && setDraft(setType(draft, type, detailed))}
      onRetime={retime}
      onPlayers={() => setPlayersOpen(true)}
      locked={locked}
      onEdit={() => void switchEditing(true)}
      editDisabled={switching}
      detailed={detailed}
      fill={panes}
      onReason={(reason) => draft && setDraft(toggleReason(draft, reason))}
      onSave={() => draft && commit(draft)}
      onCancel={cancel}
      marks={marks.length}
      review={review && { index: review.total - marks.length + 1, total: review.total }}
      onClearMarks={clearMarks}
      court={entryCourt}
    />
  );
  const stats = (
    <EventLog
      rallies={rallies}
      currentTime={player.currentTime}
      editingId={draft?.editingId ?? null}
      locked={locked}
      fill={panes}
      score={
        <Scoreboard
          rally={openRally}
          names={names}
          pending={pendingPoint}
          notice={notice}
          locked={locked}
          onPoint={recordPoint}
          onReason={setPointReason}
        />
      }
      onSeek={player.seek}
      onEdit={editEvent}
      onDelete={(id) => dispatch({ type: "deleteEvent", id })}
      onAnnotate={annotateRally}
    />
  );

  return (
    <div className={panes ? TRACKER_WORKSPACE : "flex flex-col gap-4"}>
      {statsView && (
        <Suspense fallback={<p className={MUTED}>Loading the stats…</p>}>
          <StatsPage
            sets={statsView}
            eyebrow={statsView.length === 1 && statsView[0].meta === data.meta ? "This set" : "Set files"}
            title={names.us && names.them ? `${names.us} vs ${names.them}` : "Stats"}
            initialTab="stats"
            back={{ label: "Back to the set", onBack: () => setStatsView(null) }}
            fill={panes}
            focus={focus}
            onFocus={onFocus}
          />
        </Suspense>
      )}
      {/* The tracker stays mounted under the stats, so the video and the entry in progress are where they were. */}
      <div hidden={!!statsView} className={panes ? "flex min-h-0 flex-1 flex-col gap-2" : "flex flex-col gap-4"}>
        <header className={TRACKER_BAR}>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {header}
            {locked ? (
              <span className={STATUS_NOTE}>
                <Lock size={14} aria-hidden="true" /> Locked
              </span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void switchEditing(false)}
                disabled={switching || (!data.events.length && !statsBehind)}
                title="Put your changes in the team’s stats and lock the set"
              >
                <Check size={15} aria-hidden="true" /> Done
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <SetMenu
              meta={data.meta}
              hasEvents={data.events.length > 0}
              locked={locked}
              onMeta={(meta) => dispatch({ type: "setMeta", meta })}
              onExport={exportAs}
              onStats={() => {
                player.pause();
                setStatsView([{ meta: data.meta, rallies }]);
              }}
              onImport={(file) => void importFile(file)}
              onStatsFromFiles={(files) => void statsFromFiles(files)}
              onNextSet={() => void nextSet()}
              onClear={() => void clearAll()}
            />
            <IconButton
              variant="plain"
              size="sm"
              aria-label="Undo"
              tooltip="Undo (Ctrl+Z)"
              onClick={() => dispatch({ type: "undo" })}
              disabled={locked || !state.past.length}
            >
              <Undo2 size={16} aria-hidden="true" />
            </IconButton>
            <IconButton
              variant="plain"
              size="sm"
              aria-label="Redo"
              tooltip="Redo (Ctrl+Shift+Z)"
              onClick={() => dispatch({ type: "redo" })}
              disabled={locked || !state.future.length}
            >
              <Redo2 size={16} aria-hidden="true" />
            </IconButton>
            <ShortcutHelp />
            <GuideLink topic="record" />
            {panes && (
              <IconButton
                variant="plain"
                size="sm"
                aria-label={
                  arrangement === "beside" ? "Put the entry under the video" : "Put the entry beside the video"
                }
                tooltip={arrangement === "beside" ? "Entry under the video (X)" : "Entry beside the video (X)"}
                onClick={flip}
              >
                {arrangement === "beside" ? (
                  <PanelBottom size={16} aria-hidden="true" />
                ) : (
                  <PanelRight size={16} aria-hidden="true" />
                )}
              </IconButton>
            )}
            {onFocus && (
              <IconButton
                variant="plain"
                size="sm"
                aria-label={focus ? "Leave focus mode" : "Focus mode"}
                tooltip={focus ? "Show the sidebar and top bar (V)" : "Hide the sidebar and top bar (V)"}
                aria-pressed={focus}
                onClick={() => onFocus(!focus)}
              >
                {focus ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
              </IconButton>
            )}
          </div>
        </header>

        {panes ? (
          <TrackerPanes arrangement={arrangement} video={video} actions={actions} stats={stats} />
        ) : (
          <>
            {video}
            {actions}
            {stats}
          </>
        )}
      </div>
      <PlayersDialog
        open={playersOpen}
        onOpenChange={setPlayersOpen}
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
        onAdd={(name) => dispatch({ type: "addPlayer", name })}
        onRemove={(name) => dispatch({ type: "removePlayer", name })}
        onMove={(name, to) => dispatch({ type: "movePlayer", name, to })}
        meta={data.meta}
        names={names}
        hasEvents={data.events.length > 0}
        onMeta={(meta) => dispatch({ type: "setMeta", meta })}
      />
      {dialog}
    </div>
  );
}
