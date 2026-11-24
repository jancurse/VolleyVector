import { lazy, Suspense, useEffect, useEffectEvent, useMemo, useReducer, useRef, useState } from "react";
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
import type { ModelProgress } from "../draftModel";
import { exportFilename, toCsv, toJson } from "../exporters";
import { deriveRallies, predictPlayer } from "../rallies";
import { toReportSet } from "../reportSet";
import { neighbour, openingRally, sameRow, stepRow, timeline } from "../timeline";
import type { TimelineItem } from "../timeline";
import {
  addMark,
  dropContacts,
  dropRally,
  pendingContacts,
  removeContact,
  serveJump,
  serveStandIns,
} from "../setDraft";
import { isTyping } from "../typing";
import { emptyData, initState, newId, nextSetData, parseImport, reducer } from "../store";
import type { Action } from "../store";
import type { AppData, DraftContact, Rally, ReportSet, Skill, Team } from "../types";
import { FRAME, STEP, usePlayer } from "../usePlayer";
import { extractYoutubeId } from "../youtube";
import { AiProgress } from "./AiProgress";
import { EventLog } from "./EventLog";
import { OpponentEntry } from "./OpponentEntry";
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
// The AI draft is used once a set, if at all: load it when its dialog first opens.
const AiDraftDialog = lazy(() => import("./AiDraftDialog").then((m) => ({ default: m.AiDraftDialog })));

/** Enter opens the first contact from this far before the video's time, in seconds. */
const NEAR = 1.5;
/** Enter opens the picked row while the video is still this close to it, in seconds. */
const NEAR_PICK = 0.3;
/** A manual point this soon after a decisive touch is almost certainly a duplicate. */
const DOUBLE_POINT_WINDOW = 4;
const ZONES = new Set(ZONE_GRID.flat().filter(Boolean));
/** The keys a locked set still answers: the video's, focus mode, and the arrangement. */
const VIEW_KEYS = new Set([" ", "ArrowLeft", "ArrowRight", ",", ".", "[", "]", "v", "V", "x", "X", "n", "N"]);

/** A touch of the opponent's being entered, or a recorded one (`editingId`) being changed. */
type TheirEntry = { timestamp: number; editingId?: number };

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
  const [theirs, setTheirs] = useState<TheirEntry | null>(null);
  // The draft's contacts, marked during play (Tab) or placed by a model, are described one at a time. `checking`
  // names the one to have open, by id and time: once it is saved or deleted, the next one in time takes its place.
  // `returnTo` and `resume` are where the video was when the first one was opened.
  const contacts = useMemo(() => pendingContacts(data), [data]);
  const [checking, setChecking] = useState<{ id: number; at: number; returnTo: number; resume: boolean } | null>(null);
  // The row picked in the list while it has no entry: jumped to, or last opened. ↓ and ↑ go on from it, Enter opens
  // it, and Delete removes it.
  const [cursor, setCursor] = useState<{ kind: "event" | "contact"; id: number } | null>(null);
  // The contact the open entry describes.
  const reviewed =
    checking && (theirs || draft?.editingId === null) ? contacts.find((c) => c.id === checking.id) : undefined;
  // A model's run on the set's video. It carries on with its dialog closed, and its rallies load as they finish.
  const [aiOpen, setAiOpen] = useState(false);
  // Once opened, the dialog stays mounted, so it closes with its animation.
  const [aiLoaded, setAiLoaded] = useState(false);
  const [aiRun, setAiRun] = useState<ModelProgress | "rallies" | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiStop = useRef<AbortController | null>(null);
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
  if (locked && (draft || theirs || pendingPoint || checking || playersOpen || aiOpen)) {
    setDraft(null);
    setTheirs(null);
    setPendingPoint(null);
    setChecking(null);
    setCursor(null);
    setPlayersOpen(false);
    setAiOpen(false);
  }

  if (aiOpen && !aiLoaded) setAiLoaded(true);

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
  // What the page shows of the rallies counts the draft's unrecorded rallies too, by the same rules. The stats and
  // the export read the recorded events alone.
  const standIns = useMemo(() => serveStandIns(data), [data]);
  const shown = useMemo(
    () => (standIns.length ? deriveRallies([...data.events, ...standIns], rallyMeta) : rallies),
    [standIns, data.events, rallyMeta, rallies]
  );
  const groups = useMemo(
    () => timeline(shown, contacts, data.draft?.rallies, detailed),
    [shown, contacts, data.draft?.rallies, detailed]
  );
  // When each rally with a serve has it, for the jump from rally to rally.
  const rallyStarts = useMemo(
    () => shown.filter((r) => r.serving && (r.touches.length || r.opponent.length)).map((r) => r.startTime),
    [shown]
  );
  const rows = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const openEvent = draft?.editingId ?? theirs?.editingId;
  // The row the entry belongs to. A new stat belongs to none. With no entry open, the row picked.
  const current = reviewed
    ? ({ kind: "contact", id: reviewed.id } as const)
    : openEvent != null
      ? ({ kind: "event", id: openEvent } as const)
      : draft || theirs
        ? null
        : cursor;
  // The picked row, while the video still stands on it: Enter opens it and Delete removes it only then.
  const picked = cursor && rows.find((r) => sameRow(r, cursor));
  const pickedHere = () => (picked && Math.abs(picked.time - player.getTime()) < NEAR_PICK ? picked : undefined);

  const marks = useMemo(() => contacts.map((c) => ({ time: c.time, model: c.model })), [contacts]);

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

  /**
   * Start a new stat now, or at `at` (a draft contact) without touching playback. `guess` is the skill a model gave
   * the contact, shown as a suggestion like a predicted one.
   */
  const startEntry = (
    opts: { player?: string; stat?: Skill; type?: string; fresh?: boolean } = {},
    at?: number,
    guess?: Skill
  ) => {
    if (draft || theirs || locked) return;

    setPendingPoint(null);
    setCursor(null);

    // Enter with nothing chosen goes to the contacts still to describe. A player or skill key starts a new stat.
    if (at === undefined && contacts.length && !checking && !opts.player && !opts.stat && !opts.fresh) {
      goToContact(contacts.find((c) => c.time >= player.getTime() - NEAR) ?? contacts[0]!);

      return;
    }

    // A stat started while the video is paused on a contact still to describe is that contact's, not a new one beside
    // it. During play a key starts a stat of its own, as ever.
    const here =
      at === undefined && !opts.fresh && !checking && !player.isPlaying
        ? contacts.find((c) => Math.abs(c.time - player.getTime()) < NEAR_PICK)
        : undefined;

    if (here) {
      setChecking({ id: here.id, at: here.time, returnTo: here.time, resume: false });
      openContact(here, opts);

      return;
    }

    if (at === undefined) {
      setResumeAfterEntry(player.isPlaying);
      player.pause();
    }

    const timestamp = at ?? player.getTime();
    // Predict from what happened before this moment, so tagging an earlier point in the video still gets
    // sensible suggestions.
    const before = deriveRallies(
      data.events.filter((e) => e.timestamp <= timestamp),
      rallyMeta
    );
    const ctx = before[before.length - 1];
    const last = ctx.touches[ctx.touches.length - 1] ?? null;
    // The first contact of a rally with no play recorded opens as its serve, by the side that serves it.
    const opens = opts.stat || guess ? null : openingRally(shown, contacts, timestamp);
    const opening = opens?.serving ?? null;

    if (opening === "them" && detailed && !opts.player) {
      setTheirs({ timestamp });

      return;
    }

    const stat = opts.stat ?? guess ?? (opening ? predictSkill(null, opening) : predictSkill(last, ctx.serving));
    // Our server stands in position 1 of the rally that opens here, which knows its rotation from the rallies before.
    const who =
      opts.player ?? (opening === "us" ? opens?.court?.positions[0] : undefined) ?? predictPlayer(before, stat);
    const d = newDraft(timestamp, who, stat, detailed);

    setDraft({
      ...d,
      type: opts.type ?? predictType(last, stat, detailed),
      suggested: { player: d.suggested.player && !opts.player, stat: d.suggested.stat && !opts.stat },
    });
  };

  // --- Draft contacts -------------------------------------------------------

  /**
   * Tab: a contact at the video's time. During play it is only marked, to describe later. With an entry open it
   * takes that entry's place, which is how a touch missing from the draft is added.
   */
  const mark = () => {
    if (locked || draft?.editingId != null) return;

    const time = player.getTime();
    const next = addMark(data.draft, time);

    dispatch({ type: "setDraft", draft: next });
    if (draft || theirs) {
      const added = next.contacts.find((c) => !data.draft?.contacts.some((old) => old.id === c.id));

      if (added) goToContact(added);
    }
  };

  /** Have this contact open in the entry, in place of whatever is open. */
  const goToContact = (c: DraftContact) => {
    setDraft(null);
    setTheirs(null);
    setPendingPoint(null);
    setCursor(null);
    setChecking({
      id: c.id,
      at: c.time,
      returnTo: checking?.returnTo ?? player.getTime(),
      resume: checking?.resume ?? player.isPlaying,
    });
    player.pause();
  };

  /** Jump to a row of the list and pick it, without opening it. An entry that is open closes, as with Esc. */
  const pickRow = (item: TimelineItem) => {
    setChecking(null);
    setDraft(null);
    setTheirs(null);
    setPendingPoint(null);
    setResumeAfterEntry(false);
    setCursor({ kind: item.kind, id: item.kind === "contact" ? item.contact.id : item.event.id });
    player.pause();
    player.seek(item.time);
  };

  /** Open a row of the list: a contact to describe it, a recorded event to change it. */
  const openRow = (item: TimelineItem) => {
    if (item.kind === "contact") return goToContact(item.contact);

    const e = item.event;

    pickRow(item);
    setDraft(e.kind === "touch" ? draftFromTouch(e) : null);
    if (e.kind === "point") setPendingPoint({ id: e.id, winner: e.winner });
    if (e.kind === "opponent") setTheirs({ timestamp: e.timestamp, editingId: e.id });
  };

  /**
   * ↓ and ↑: the row after or before the one open or picked, or else after or before the video's time. With an
   * entry open the next row opens too. Otherwise it is only jumped to. A new stat or serve of theirs left half
   * entered stays as a contact to describe, so moving on loses no touch.
   */
  const stepTo = (direction: 1 | -1) => {
    const to = stepRow(rows, current, player.getTime(), direction);

    if (!to) return;
    if (!draft && !theirs) return pickRow(to);
    // A change to a recorded stat is kept when moving on from it.
    if (draft?.editingId != null && isComplete(draft))
      dispatch({ type: "updateEvent", event: draftToTouch(draft, draft.editingId) });
    const fresh = !reviewed && (draft ? draft.editingId === null && (draft.player || draft.stat) : !theirs?.editingId);

    if (fresh) dispatch({ type: "setDraft", draft: addMark(data.draft, (draft ?? theirs)!.timestamp) });
    openRow(to);
  };

  /**
   * Move the open row in time, the video with it. It is saved at once. `to` gives the new time from the row's own:
   * < and > step it, and / puts it where the video is.
   */
  const moveRow = (to: (from: number) => number) => {
    if (locked) return;

    const entry = theirs ?? draft;
    const row = current ? rows.find((r) => sameRow(r, current)) : undefined;
    const from = entry?.timestamp ?? row?.time;

    if (from === undefined) return;

    const time = Math.max(0, to(from));

    if (current && row) dispatch({ type: "move", row: current.kind, id: current.id, time });
    if (checking && current?.kind === "contact") setChecking({ ...checking, at: time });
    if (theirs) setTheirs({ ...theirs, timestamp: time });
    else if (draft) setDraft({ ...draft, timestamp: time });
    player.pause();
    player.seek(time);
  };
  /** N and Shift+N, and the video's Next rally: to the next rally's start, or the one before. */
  const jumpRally = (direction: 1 | -1) => {
    const to = serveJump(rallyStarts, player.getTime(), direction);

    if (to !== null) player.seek(to);
  };
  const nudge = (by: number) => moveRow((from) => from + by);
  const stamp = () => moveRow(() => player.getTime());

  /** Show a draft contact and open its entry: ours, or the opponent's on a set that records their touches. */
  const openContact = (c: DraftContact, opts: { player?: string; stat?: Skill; type?: string } = {}) => {
    player.seek(c.time);

    if (c.side === "them" && detailed) {
      setPendingPoint(null);
      setTheirs({ timestamp: c.time });
    } else startEntry(opts, c.time, c.skill);
  };

  // Open the contact `checking` names, or the next one in time once that one is saved or deleted, so its
  // predictions already include the stat just entered. Held while a just-recorded point is waiting for its
  // optional reason.
  const nextContact = useEffectEvent(() => {
    if (!checking || draft || theirs || pendingPoint) return;

    const next =
      contacts.find((c) => c.id === checking.id) ?? neighbour(contacts, { time: checking.at, id: checking.id }, 1);

    if (next) {
      if (next.id !== checking.id) setChecking({ ...checking, id: next.id, at: next.time });
      openContact(next);

      return;
    }

    // The last one is done. Marks made during play lie behind where the video was: carry on from there.
    if (checking.returnTo > checking.at) {
      player.seek(checking.returnTo);
      if (checking.resume) player.play();
    }
    setChecking(null);
  });

  useEffect(() => {
    // After this render settles, so the stat just entered is in the data the next one predicts from.
    const timer = setTimeout(() => nextContact(), 0);

    return () => clearTimeout(timer);
  }, [checking, draft, theirs, data.draft, pendingPoint]);

  const commit = (d: Draft) => {
    if (!isComplete(d)) return;

    if (d.editingId !== null) dispatch({ type: "updateEvent", event: draftToTouch(d, d.editingId) });
    else dispatch({ type: "addEvent", event: draftToTouch(d, newId(data.events)), contact: reviewed?.id });
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

  /** Esc: close this entry. A contact it described stays in the draft, to describe later. */
  const cancel = () => {
    setChecking(null);
    setCursor(null);
    setDraft(null);
    setTheirs(null);
    resume();
  };

  /** Delete a contact that was never one (a false contact of a model's, or a tap by mistake). */
  const deleteContact = (id: number) => {
    dispatch({ type: "setDraft", draft: removeContact(data.draft, id) });
    if (id !== reviewed?.id) return;

    setDraft(null);
    setTheirs(null);
  };

  const clearMarks = () => {
    dispatch({ type: "setDraft", draft: dropContacts(data.draft, "marks") });
    if (checking) cancel();
  };

  // --- The opponent's touches ----------------------------------------------

  /** Enter a touch of the opponent's at the stat being entered, or else at the video's time. */
  const startTheirs = () => {
    if (locked || !detailed || draft?.editingId != null) return;

    setPendingPoint(null);

    if (!draft) {
      setResumeAfterEntry(player.isPlaying);
      player.pause();
    }

    setTheirs({
      timestamp: draft?.timestamp ?? player.getTime(),
    });
    setDraft(null);
  };

  /** Record their serve. One that is recorded already has nothing more to save: a move in time is saved at once. */
  const saveTheirs = () => {
    if (!theirs) return;

    if (theirs.editingId == null) {
      dispatch({
        type: "addEvent",
        event: { kind: "opponent", id: newId(data.events), timestamp: theirs.timestamp, stat: "serve" },
        contact: reviewed?.id,
      });
      resume();
    }

    setTheirs(null);
  };

  /** It was our touch after all: enter it at the same moment. */
  const backToOurs = () => {
    if (!theirs) return;

    const at = theirs.timestamp;

    setTheirs(null);
    setDraft(newDraft(at, "", "", detailed));
  };

  const recordPoint = (winner: Team, reason?: string) => {
    // While describing marks, a point means the current mark was the opponent's contact (e.g. their attack
    // out): the point takes that mark's place and time.
    const markAt = checking && draft?.editingId === null ? draft.timestamp : undefined;

    setDraft(null);

    // Guard against double-recording: a decisive touch already ended this rally.
    const prev = rallies[rallies.length - 2];
    const now = markAt ?? player.getTime();

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

    dispatch({
      type: "addEvent",
      event: { kind: "point", id, timestamp: now, winner, ...(reason && { reason }) },
      contact: markAt !== undefined ? reviewed?.id : undefined,
    });
    setPendingPoint(reason ? null : { id, winner });
    resume();
  };

  /** Give an inferred rally end an explicit reason, e.g. "opponent attack error". */
  const annotateRally = (r: Rally, reason: string) => {
    if (!r.winner) return;

    // Place the point right after the rally's last touch (or the previous rally's end, for a rally with no
    // touches of either team) so it closes the same rally.
    const after = r.touches.length || r.opponent.length ? r.endTime : (shown[r.index - 2]?.endTime ?? 0);

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

    // Shift with , and . moves the open row by a tenth of a second, and with Alt by half a second. On a Mac, Alt
    // changes the character those keys type, so the physical key is read too.
    const later = e.key === ">" || (e.altKey && e.shiftKey && e.code === "Period");

    if (!mod && (later || e.key === "<" || (e.altKey && e.shiftKey && e.code === "Comma"))) {
      e.preventDefault();
      nudge((later ? 1 : -1) * (e.altKey ? 0.5 : STEP));

      return;
    }

    if (!mod && e.key === "/" && (draft || theirs)) {
      e.preventDefault();
      stamp();

      return;
    }

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

    if (e.key === "Delete" && reviewed) {
      e.preventDefault();
      deleteContact(reviewed.id);

      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      stepTo(e.key === "ArrowDown" ? 1 : -1);

      return;
    }

    if (e.key === "Delete" && !draft && !theirs) {
      const row = pickedHere();

      if (!row) return;
      e.preventDefault();
      if (row.kind === "event") dispatch({ type: "deleteEvent", id: row.event.id });
      else deleteContact(row.contact.id);
      setCursor(null);

      return;
    }

    if (e.key === "Tab" && (draft || theirs)) {
      e.preventDefault();
      mark();

      return;
    }

    if (e.key.toLowerCase() === "n") {
      e.preventDefault();
      jumpRally(e.shiftKey ? -1 : 1);

      return;
    }

    // While a touch of the opponent's is open, its own few keys and the video's are the only ones live.
    if (theirs && !VIEW_KEYS.has(e.key)) {
      const key = e.key.toLowerCase();

      e.preventDefault();
      if (key === "s" || e.key === "Enter") saveTheirs();
      else if (key === "o") backToOurs();
      else if (e.key === "Escape") cancel();

      return;
    }

    if (detailed && !e.shiftKey && e.key.toLowerCase() === "o") {
      e.preventDefault();
      startTheirs();

      return;
    }

    // Right after a manual point, a number key picks its reason; anything else dismisses the prompt.
    if (pendingPoint) {
      const reason = digit && !e.shiftKey ? POINT_REASONS[pendingPoint.winner][Number(digit) - 1] : undefined;

      if (reason) {
        e.preventDefault();
        setPointReason(reason.id);

        return;
      }

      setPendingPoint(null);

      // The next contact opens by itself, so the dismissing key must not start a stat of its own.
      if (e.key === "Escape" || checking) {
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
        mark();
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
      case "Enter": {
        const row = pickedHere();

        handled();
        if (draft) commit(draft);
        else if (row) openRow(row);
        else startEntry();
        break;
      }
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

  const runAi = async (key: string, from: number, to: number | undefined) => {
    const controller = new AbortController();

    aiStop.current = controller;
    setAiError(null);
    setAiRun("rallies");
    dispatch({ type: "setDraft", draft: dropContacts(data.draft, "model") });
    try {
      const { runModel } = await import("../draftModel");
      const run = await runModel({
        key,
        url: data.meta.youtubeUrl,
        meta: data.meta,
        from,
        to,
        signal: controller.signal,
        onProgress: setAiRun,
        onRally: (model) => apply({ type: "addDraft", model }),
      });

      setNotice(
        run.rallies
          ? `AI draft ready: ${run.rallies} ${run.rallies === 1 ? "rally" : "rallies"}, for about $${run.cost.toFixed(2)}.` +
              (run.served < run.rallies ? ` Rallies without a guess at who serves: ${run.rallies - run.served}.` : "")
          : "The AI found no rally in that part of the video."
      );
    } catch (e) {
      if (!controller.signal.aborted) {
        setAiError(e instanceof Error ? e.message : String(e));
        setAiOpen(true);
      }
    }
    setAiRun(null);
  };

  // A run ends with the tracker, and when the set is locked.
  useEffect(() => () => aiStop.current?.abort(), []);
  useEffect(() => {
    if (locked) aiStop.current?.abort();
  }, [locked]);

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
      onNextServe={rallyStarts.length ? () => jumpRally(1) : undefined}
      locked={locked}
      fill={panes}
    />
  );
  const reviewing = reviewed ? { left: contacts.length, ai: !!reviewed.model } : null;
  const actions = theirs ? (
    <OpponentEntry
      entry={theirs}
      fill={panes}
      review={reviewing}
      onSave={saveTheirs}
      onOurs={backToOurs}
      onCancel={cancel}
      onDelete={reviewed && (() => deleteContact(reviewed.id))}
      onStep={stepTo}
      onNudge={nudge}
      onStamp={stamp}
      onPlayers={() => setPlayersOpen(true)}
    />
  ) : (
    <StatEntry
      draft={draft}
      players={data.players}
      onStart={(opts) => startEntry(opts)}
      onChange={change}
      onType={(type) => draft && setDraft(setType(draft, type, detailed))}
      onNudge={nudge}
      onStamp={stamp}
      onNew={() => startEntry({ fresh: true })}
      onPlayers={() => setPlayersOpen(true)}
      locked={locked}
      onEdit={() => void switchEditing(true)}
      editDisabled={switching}
      detailed={detailed}
      fill={panes}
      onReason={(reason) => draft && setDraft(toggleReason(draft, reason))}
      onSave={() => draft && commit(draft)}
      onCancel={cancel}
      marks={contacts.length}
      ownMarks={contacts.filter((c) => !c.model).length}
      review={reviewing}
      onClearMarks={clearMarks}
      onDeleteContact={() => reviewed && deleteContact(reviewed.id)}
      onStep={stepTo}
      onTheirs={startTheirs}
      onAi={
        !data.events.length && !contacts.length && !data.draft?.rallies.length && !aiRun
          ? () => setAiOpen(true)
          : undefined
      }
      court={entryCourt}
    />
  );
  const stats = (
    <EventLog
      rallies={shown}
      groups={groups}
      names={names}
      pending={contacts.length}
      currentTime={player.currentTime}
      current={current}
      locked={locked}
      fill={panes}
      onPick={pickRow}
      onOpen={openRow}
      onDeleteContact={deleteContact}
      onDropRally={(start) => dispatch({ type: "setDraft", draft: dropRally(data.draft, start) })}
      score={
        <Scoreboard
          rally={shown[shown.length - 1]!}
          unconfirmed={standIns.length}
          names={names}
          pending={pendingPoint}
          notice={notice}
          locked={locked}
          onPoint={recordPoint}
          onReason={setPointReason}
        />
      }
      onSeek={player.seek}
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
              onAi={() => setAiOpen(true)}
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
        {aiRun && <AiProgress run={aiRun} onStop={() => aiStop.current?.abort()} />}

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
              timestamp: player.getTime(),
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
      {aiLoaded && (
        <Suspense fallback={null}>
          <AiDraftDialog
            open={aiOpen}
            onOpenChange={setAiOpen}
            meta={data.meta}
            running={!!aiRun}
            error={aiError}
            videoTime={player.getTime}
            onMeta={(meta) => dispatch({ type: "setMeta", meta })}
            onStart={(key, from, to) => void runAi(key, from, to)}
          />
        </Suspense>
      )}
      {dialog}
    </div>
  );
}
