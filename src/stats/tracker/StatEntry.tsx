import type { JSX } from "react";
import { Pencil, Sparkles } from "lucide-react";

import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { CALLOUT_NOTE, cx, ENTRY_CAPTION, ENTRY_STEPS, PANEL, PANEL_SCROLL } from "../../ui/styles";
import {
  ENTRY_SKILLS,
  resultLabel,
  resultsFor,
  skillLabel,
  touchReasonLabel,
  touchReasonsFor,
  typesFor,
  zeroLabel,
  zoneHint,
  zoneSide,
} from "../codes";
import { currentStep, draftType, isComplete } from "../draft";
import type { Draft, Field } from "../draft";
import type { Court, Skill } from "../types";
import { Choice } from "./Choice";
import { EntrySection } from "./EntrySection";
import { ContactSteps } from "./ContactSteps";
import { Kbd } from "./Kbd";
import { EntryTag } from "./EntryTag";
import { TimeStepper } from "./TimeStepper";
import { LOCKED_HINT } from "./locked";
import { PlayerChoices } from "./PlayerChoices";
import { Underlined } from "./Underlined";
import { ZoneChoices } from "./ZoneChoices";

type StatEntryProps = {
  draft: Draft | null;
  players: readonly string[];
  onStart: (opts?: { player?: string; stat?: Skill }) => void;
  onChange: (field: Field, value: string) => void;
  /** Pick the kind of attack or defense. */
  onType: (type: string) => void;
  /** Move the entry in time by a number of seconds. */
  onNudge: (by: number) => void;
  /** Move it to the video's time. */
  onStamp: () => void;
  /** Start a stat at the video's time, leaving the contacts still to describe. */
  onNew: () => void;
  /** Open the lineup and player list. */
  onPlayers: () => void;
  /** A locked set: nothing can be entered until Edit set is pressed. */
  locked: boolean;
  onEdit: () => void;
  editDisabled: boolean;
  /** Whether the set records detailed stats, which decides the kinds and results on offer. */
  detailed: boolean;
  /** Fill the pane it sits in and scroll inside it, its steps side by side when the pane is wide. */
  fill: boolean;
  onReason: (reason: string) => void;
  onSave: () => void;
  onCancel: () => void;
  /** The draft's contacts not yet described, and how many of them the recorder marked. */
  marks: number;
  ownMarks: number;
  /** Set while the entry describes a contact of the draft: how many are left, and whether a model placed this one. */
  review: { left: number; ai: boolean } | null;
  /** Open the AI draft dialog. Present only while the set is empty, where the button shows. */
  onAi?: () => void;
  /** Discard the recorder's own marks. */
  onClearMarks: () => void;
  /** Delete the contact being described from the draft. */
  onDeleteContact: () => void;
  /** Go to the contact after (1) or before (-1) this one. */
  onStep: (direction: 1 | -1) => void;
  /** Enter this contact as a touch of the opponent's. */
  onTheirs: () => void;
  /** Who is on court at this stat's moment. */
  court: Court | null;
};

/** Skills and kinds: four across in a column, two across once the steps sit side by side in a wide pane. */
const CHOICE_GRID = "grid grid-cols-2 gap-1.5 sm:grid-cols-4 @4xl:grid-cols-2";

/** Entering a stat: player, skill, result, zone, each by click or by key. New stats save once complete. */
export function StatEntry({
  draft,
  players,
  onStart,
  onChange,
  onType,
  onNudge,
  onStamp,
  onNew,
  onPlayers,
  locked,
  onEdit,
  editDisabled,
  detailed,
  fill,
  onReason,
  onSave,
  onCancel,
  marks,
  ownMarks,
  review,
  onClearMarks,
  onDeleteContact,
  onStep,
  onTheirs,
  onAi,
  court,
}: StatEntryProps): JSX.Element {
  const step = draft ? currentStep(draft) : null;
  const editing = draft?.editingId != null;
  const pick = (field: "player" | "stat", value: string) =>
    draft ? onChange(field, value) : onStart({ [field]: value });
  const reasons = draft ? touchReasonsFor(draft.stat, draft.result) : [];
  const types = draft ? typesFor(draft.stat, detailed) : [];
  const results = draft ? resultsFor(draft.stat, detailed) : [];

  return (
    <section className={cx(fill ? PANEL_SCROLL : PANEL, "@container")} aria-label="Stat entry">
      {locked ? (
        <>
          <Button className="w-full" onClick={onEdit} disabled={editDisabled}>
            <Pencil size={15} aria-hidden="true" /> Edit set
          </Button>
          <p className={ENTRY_CAPTION}>Locked, so nothing changes it by accident.</p>
        </>
      ) : !draft && marks > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button
            className="flex-1"
            onClick={() => onStart()}
            title="Open the next contact still to describe, from where the video is"
          >
            Next contact <Kbd onAccent>Enter</Kbd>
          </Button>
          <Button variant="ghost" paired onClick={onNew} title="Start a stat at the video’s time">
            New stat
          </Button>
          {ownMarks > 0 && (
            <Button variant="ghost" paired onClick={onClearMarks} title="Discard the contacts you marked">
              Clear marks
            </Button>
          )}
        </div>
      ) : !draft ? (
        <div className="flex flex-wrap gap-2">
          <Button className="flex-1" onClick={() => onStart()}>
            New stat <Kbd onAccent>Enter</Kbd>
          </Button>
          {onAi && (
            <Button variant="ghost" paired onClick={onAi} title="Let a model find the rallies in the video">
              <Sparkles size={15} aria-hidden="true" /> Draft with AI
            </Button>
          )}
        </div>
      ) : (
        <div
          className={cx(
            "flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md px-3 py-2",
            editing || review ? "bg-control" : "bg-accent-weak"
          )}
        >
          <TimeStepper time={draft.timestamp} onNudge={onNudge} onStamp={onStamp} />
          <EntryTag review={editing ? null : review} label={editing ? "Editing" : "New stat"} />
          <span className="flex-1" />
          <ContactSteps onStep={onStep} />
          <Button
            variant="ghost"
            onClick={onCancel}
            title={review && !editing ? "Close the entry. The contact stays, to describe later" : undefined}
          >
            {review && !editing ? "Close" : "Cancel"} <Kbd>Esc</Kbd>
          </Button>
          {review && !editing && (
            <Button variant="ghost" onClick={onDeleteContact} title="No contact here: delete it">
              Delete <Kbd>Del</Kbd>
            </Button>
          )}
          {(editing || draft.stat === "misc") && (
            <Button size="sm" onClick={onSave} disabled={!isComplete(draft)}>
              Save <Kbd onAccent>Enter</Kbd>
            </Button>
          )}
          <p className="m-0 w-full truncate font-mono text-base font-semibold text-text">
            {draft.player || "_"} · {draft.stat ? skillLabel({ stat: draft.stat, type: draft.type }) : "?"} ·{" "}
            {draft.stat && draft.result ? resultLabel(draft.stat, draft.result) : "?"}
            {draft.stat && draft.reason ? ` (${touchReasonLabel(draft.stat, draft.result, draft.reason)})` : ""} ·{" "}
            {draft.zone || "?"}
          </p>
        </div>
      )}
      {!locked && !draft && marks === 0 && (
        <p className={cx(ENTRY_CAPTION, "pointer-coarse:hidden")}>Or tap Tab on each contact while the video plays.</p>
      )}

      <fieldset disabled={locked} title={locked ? LOCKED_HINT : undefined} className={ENTRY_STEPS}>
        <EntrySection
          title="Player"
          wide
          active={step === "player"}
          hint={draft ? (step === "player" ? "press 1–9, 0" : "⇧ + number to change") : "press 1–9, 0 to start"}
          action={
            <Button variant="text" size="sm" onClick={onPlayers} title="Lineup, substitutions, and the player list">
              Change
            </Button>
          }
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
          <div className={CHOICE_GRID}>
            {ENTRY_SKILLS.map((s) => (
              <Choice
                key={s.id}
                label={s.label}
                selected={draft?.stat === s.id || (s.id === "attack" && draft?.stat === "freeball")}
                suggested={draft?.suggested.stat}
                hotkey={s.key.toUpperCase()}
                onClick={() => pick("stat", s.id)}
              >
                <Underlined label={s.label} letter={s.key} />
              </Choice>
            ))}
          </div>
        </EntrySection>

        {draft && types.length > 0 && (
          <EntrySection title="Kind" active={false} hint="letter keys, any time">
            <div className={CHOICE_GRID}>
              {types.map((t) => (
                <Choice
                  key={t.id}
                  label={t.label}
                  selected={draftType(draft, detailed) === t.id}
                  hotkey={t.key.toUpperCase()}
                  onClick={() => onType(t.id)}
                >
                  <Underlined label={t.label} letter={t.key} />
                </Choice>
              ))}
            </div>
          </EntrySection>
        )}

        {draft?.stat && (
          <EntrySection
            title="Result"
            active={step === "result"}
            hint={
              draft.stat === "misc" ? "type, then Enter" : step === "result" ? `press 1–${results.length}` : undefined
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
              <div className="grid grid-cols-3 gap-1.5 @4xl:grid-cols-2">
                {results.map((r, i) => (
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
            wide
            active={step === "zone"}
            hint={step === "zone" ? "press the zone number" : undefined}
          >
            <p className="m-0 mb-1.5 text-xs text-text-dim">{zoneHint(draft.stat, draft.result)}</p>
            <ZoneChoices
              zone={draft.zone}
              live={step === "zone"}
              side={zoneSide(draft.stat)}
              zero={zeroLabel(draft.stat, draft.result)}
              onPick={(z) => onChange("zone", z)}
            />
          </EntrySection>
        )}
      </fieldset>

      {review && !editing && (
        <p className={CALLOUT_NOTE}>
          Opponent’s contact? Press <Kbd>+</Kbd> if it was their error (then a number for the reason) or <Kbd>-</Kbd> if
          it won them the point.
          {detailed && (
            <>
              {" "}
              Press <Kbd>O</Kbd> for their serve.
            </>
          )}
        </p>
      )}
      {detailed && draft && !editing && !review && (
        <Button variant="text" size="sm" className="self-start" onClick={onTheirs}>
          Their serve <Kbd>O</Kbd>
        </Button>
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
