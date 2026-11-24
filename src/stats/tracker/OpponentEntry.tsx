import type { JSX } from "react";

import { Button } from "../../ui/Button";
import { cx, PANEL, PANEL_SCROLL } from "../../ui/styles";
import { ContactSteps } from "./ContactSteps";
import { Kbd } from "./Kbd";
import { EntryTag } from "./EntryTag";
import { TimeStepper } from "./TimeStepper";

type OpponentEntryProps = {
  /** `editingId` is set while a recorded serve of theirs is open. */
  entry: { timestamp: number; editingId?: number };
  /** Fill the pane it sits in and scroll inside it. */
  fill: boolean;
  /** Set while the entry describes a contact of the draft: how many are left, and whether a model placed this one. */
  review: { left: number; ai: boolean } | null;
  onSave: () => void;
  /** It was our touch after all. */
  onOurs: () => void;
  onCancel: () => void;
  /** Delete the contact being described from the draft; absent outside a review. */
  onDelete: (() => void) | undefined;
  /** Go to the contact after (1) or before (-1) this one. */
  onStep: (direction: 1 | -1) => void;
  /** Open the lineup and player list. */
  onPlayers: () => void;
  /** Move the touch in time by a number of seconds. */
  onNudge: (by: number) => void;
  /** Move it to the video's time. */
  onStamp: () => void;
};

/**
 * Entering the opponent's serve on a set with detailed stats. It holds nothing but its time.
 */
export function OpponentEntry({
  entry,
  fill,
  review,
  onSave,
  onOurs,
  onCancel,
  onDelete,
  onStep,
  onNudge,
  onStamp,
  onPlayers,
}: OpponentEntryProps): JSX.Element {
  return (
    <section className={cx(fill ? PANEL_SCROLL : PANEL, "@container")} aria-label="Opponent’s touch">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md bg-control px-3 py-2">
        <TimeStepper time={entry.timestamp} onNudge={onNudge} onStamp={onStamp} />
        <EntryTag review={review} label={entry.editingId != null ? "Editing" : "Their serve"} />
        <span className="flex-1" />
        <ContactSteps onStep={onStep} />
        <Button
          variant="ghost"
          onClick={onCancel}
          title={review ? "Close the entry. The contact stays, to describe later" : undefined}
        >
          {review ? "Close" : "Cancel"} <Kbd>Esc</Kbd>
        </Button>
        {onDelete && (
          <Button variant="ghost" onClick={onDelete} title="No contact here: delete it">
            Delete <Kbd>Del</Kbd>
          </Button>
        )}
        <p className="m-0 w-full truncate font-mono text-base font-semibold text-text">Opponent · Serve</p>
      </div>
      <Button
        variant="text"
        size="sm"
        className="self-start"
        onClick={onPlayers}
        title="Lineup, substitutions, and the player list"
      >
        Lineup
      </Button>

      <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-dim">
        <Button variant="text" size="sm" onClick={onOurs}>
          Our touch <Kbd>O</Kbd>
        </Button>
        <Button variant="primary" size="sm" onClick={onSave}>
          {entry.editingId != null ? "Done" : "Save their serve"} <Kbd>Enter</Kbd>
        </Button>
      </p>
    </section>
  );
}
