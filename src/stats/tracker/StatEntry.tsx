import type { JSX } from "react";

import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { CALLOUT_NOTE, cx, PANEL } from "../../ui/styles";
import { resultLabel, resultsFor, skillDef, SKILLS, touchReasonLabel, touchReasonsFor } from "../codes";
import { currentStep, isComplete } from "../draft";
import type { Draft, Field } from "../draft";
import { formatTime } from "../exporters";
import type { Court, Skill } from "../types";
import { Choice } from "./Choice";
import { EntrySection } from "./EntrySection";
import { Kbd } from "./Kbd";
import { PlayerChoices } from "./PlayerChoices";
import { Underlined } from "./Underlined";
import { ZoneChoices } from "./ZoneChoices";

type StatEntryProps = {
  draft: Draft | null;
  players: readonly string[];
  onStart: (opts?: { player?: string; stat?: Skill }) => void;
  onChange: (field: Field, value: string) => void;
  onReason: (reason: string) => void;
  onSave: () => void;
  onCancel: () => void;
  /** Contacts marked during play and not yet described. */
  marks: number;
  /** Set while stepping through marked contacts. */
  review: { index: number; total: number } | null;
  onClearMarks: () => void;
  /** Who is on court at this stat's moment. */
  court: Court | null;
};

/** Entering a stat: player, skill, result, zone, each by click or by key. New stats save once complete. */
export function StatEntry({
  draft,
  players,
  onStart,
  onChange,
  onReason,
  onSave,
  onCancel,
  marks,
  review,
  onClearMarks,
  court,
}: StatEntryProps): JSX.Element {
  const step = draft ? currentStep(draft) : null;
  const editing = draft?.editingId != null;
  const pick = (field: "player" | "stat", value: string) =>
    draft ? onChange(field, value) : onStart({ [field]: value });
  const reasons = draft ? touchReasonsFor(draft.stat, draft.result) : [];

  return (
    <section className={PANEL} aria-label="Stat entry">
      {!draft && marks > 0 ? (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => onStart()}>
            Describe {marks} marked contact{marks === 1 ? "" : "s"} <Kbd onAccent>Enter</Kbd>
          </Button>
          <Button variant="ghost" paired onClick={onClearMarks} title="Discard all marks">
            Clear
          </Button>
        </div>
      ) : !draft ? (
        <Button className="w-full" onClick={() => onStart()}>
          New stat <Kbd onAccent>Enter</Kbd>
        </Button>
      ) : (
        <div
          className={cx(
            "flex items-center gap-2 rounded-md px-3 py-2",
            editing || review ? "bg-control" : "bg-accent-weak"
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="m-0 text-xs text-text-dim">
              {editing ? (
                "Editing"
              ) : review ? (
                <b className="text-text">
                  Contact {review.index} of {review.total}
                </b>
              ) : (
                "New stat"
              )}{" "}
              @ {formatTime(draft.timestamp)}
            </p>
            <p className="m-0 truncate font-mono text-lg font-bold text-text">
              {draft.player || "_"} · {draft.stat || "?"} ·{" "}
              {draft.stat && draft.result ? resultLabel(draft.stat, draft.result) : "?"}
              {draft.stat && draft.reason
                ? ` (${touchReasonLabel(draft.stat, draft.result, draft.reason)})`
                : ""} · {draft.zone || "?"}
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={onCancel}
            title={review && !editing ? "Discard this mark (e.g. tapped by mistake) and go to the next" : undefined}
          >
            {review && !editing ? "Skip" : "Cancel"} <Kbd>Esc</Kbd>
          </Button>
          {review && !editing && (
            <Button variant="text" onClick={onClearMarks} title="Discard the remaining marks">
              Stop
            </Button>
          )}
          {(editing || draft.stat === "misc") && (
            <Button size="sm" onClick={onSave} disabled={!isComplete(draft)}>
              Save <Kbd onAccent>Enter</Kbd>
            </Button>
          )}
        </div>
      )}
      {!draft && marks === 0 && (
        <p className="m-0 -mt-2 text-center text-xs text-text-dim pointer-coarse:hidden">
          Or tap Tab on each contact while the video plays.
        </p>
      )}

      <EntrySection
        title="Player"
        active={step === "player"}
        hint={draft ? (step === "player" ? "press 1–9, 0" : "⇧ + number to change") : "press 1–9, 0 to start"}
      >
        <PlayerChoices
          draft={draft}
          players={players}
          court={court}
          keysLive={!draft || step === "player"}
          onPick={(p) => pick("player", p)}
        />
      </EntrySection>

      <EntrySection
        title="Skill"
        active={step === "stat"}
        hint={draft ? "letter keys, any time" : "letter key to start"}
      >
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {SKILLS.map((s) => (
            <Choice
              key={s.id}
              label={s.label}
              selected={draft?.stat === s.id}
              suggested={draft?.suggested.stat}
              hotkey={s.key.toUpperCase()}
              onClick={() => pick("stat", s.id)}
            >
              <Underlined label={s.label} letter={s.key} />
            </Choice>
          ))}
        </div>
      </EntrySection>

      {draft?.stat && (
        <EntrySection
          title="Result"
          active={step === "result"}
          hint={
            draft.stat === "misc"
              ? "type, then Enter"
              : step === "result"
                ? `press 1–${resultsFor(draft.stat).length}`
                : undefined
          }
        >
          {draft.stat === "misc" ? (
            <Input
              autoFocus
              aria-label="What happened"
              value={draft.result}
              onChange={(e) => onChange("result", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isComplete(draft)) onSave();
                if (e.key === "Escape") onCancel();
              }}
              placeholder="Describe what happened"
            />
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {resultsFor(draft.stat).map((r, i) => (
                <Choice
                  key={r.id}
                  selected={draft.result === r.id}
                  hotkey={String(i + 1)}
                  hotkeyDim={step !== "result"}
                  title={r.help}
                  tone={r.point === "us" ? "good" : r.point === "them" ? "bad" : undefined}
                  onClick={() => onChange("result", r.id)}
                >
                  {r.label}
                </Choice>
              ))}
            </div>
          )}
          {reasons.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-text-dim">Why? (optional, before the zone)</span>
              {reasons.map((r) => (
                <Button
                  key={r.id}
                  variant={draft.reason === r.id ? "primary" : "ghost"}
                  size="sm"
                  aria-pressed={draft.reason === r.id}
                  onClick={() => onReason(r.id)}
                >
                  {r.label} <Kbd onAccent={draft.reason === r.id}>{r.key.toUpperCase()}</Kbd>
                </Button>
              ))}
            </div>
          )}
        </EntrySection>
      )}

      {draft?.stat && (
        <EntrySection
          title="Zone"
          active={step === "zone"}
          hint={step === "zone" ? "press the zone number" : undefined}
        >
          <p className="m-0 mb-1.5 text-xs text-text-dim">{skillDef(draft.stat).zoneHint}</p>
          <ZoneChoices zone={draft.zone} live={step === "zone"} onPick={(z) => onChange("zone", z)} />
        </EntrySection>
      )}

      {review && !editing && (
        <p className={CALLOUT_NOTE}>
          Opponent’s contact? Press <Kbd>+</Kbd> if it was their error (then a number for the reason) or <Kbd>-</Kbd> if
          it won them the point.
        </p>
      )}
      {draft && (
        <p className="m-0 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-dim">
          <span>
            <Kbd>⌫</Kbd> undo last choice
          </span>
          <span>
            <Kbd>Esc</Kbd> cancel
          </span>
          {!editing && draft.stat !== "misc" && <span>Saves automatically once the zone is set</span>}
        </p>
      )}
    </section>
  );
}
