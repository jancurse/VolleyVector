import type { JSX } from "react";
import { CircleDashed, Sparkles, Volleyball } from "lucide-react";

import { cx, THEM_TEXT, US_TEXT } from "../../ui/styles";
import { skillLabel } from "../codes";
import type { DraftContact } from "../types";
import { LogRow } from "./LogRow";

/** What a contact is thought to be, as far as its side and skill are known. */
function guess(c: DraftContact, opponent: string): string {
  if (c.side === "them") return c.skill === "serve" ? opponent || "Opponent" : "Their touch";

  return c.skill ? skillLabel({ stat: c.skill }) : "Contact";
}

/**
 * A contact still to describe, in the log beside the recorded events: a dashed rule and an open circle where a
 * recorded row has its outcome. One thought to be a serve carries the ball in its team's colour, as a recorded serve
 * does.
 */
export function ContactRow({
  contact: c,
  opponent,
  current,
  locked,
  onPick,
  onOpen,
  onDelete,
}: {
  contact: DraftContact;
  /** The opponent's name, which is all their serve says. */
  opponent: string;
  current: boolean;
  locked: boolean;
  onPick: () => void;
  onOpen: () => void;
  onDelete: () => void;
}): JSX.Element {
  return (
    <LogRow
      time={c.time}
      current={current}
      locked={locked}
      rule="border-dashed border-l-border"
      open="Describe"
      remove="Delete contact"
      onPick={onPick}
      onOpen={onOpen}
      onDelete={onDelete}
    >
      {c.skill === "serve" && c.side ? (
        <Volleyball
          size={12}
          className={cx("flex-none", c.side === "us" ? US_TEXT : THEM_TEXT)}
          aria-label={c.side === "us" ? "Our serve" : "Their serve"}
        />
      ) : (
        <CircleDashed size={14} className="flex-none text-text-dim" aria-hidden="true" />
      )}
      <span className="truncate text-sm text-text-dim italic">{guess(c, opponent)}?</span>
      {c.model && <Sparkles size={12} className="flex-none text-accent" aria-label="Placed by AI" />}
    </LogRow>
  );
}
