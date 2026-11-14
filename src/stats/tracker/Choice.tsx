import type { JSX, ReactNode } from "react";

import { CHOICE_BASE, CHOICE_TONE, cx } from "../../ui/styles";
import { Kbd } from "./Kbd";

type ChoiceProps = {
  children: ReactNode;
  /** The name to announce when the visible label is split up (an underlined shortcut letter). */
  label?: string;
  selected: boolean;
  /** Pre-filled by prediction rather than picked: drawn dashed until confirmed. */
  suggested?: boolean;
  hotkey?: string | null;
  hotkeyDim?: boolean;
  title?: string;
  /** Who a result awards the rally to. */
  tone?: "good" | "bad";
  onClick: () => void;
};

/** One pick in the stat entry: a player, skill, result, or zone, with its hotkey. */
export function Choice({
  children,
  label,
  selected,
  suggested,
  hotkey,
  hotkeyDim,
  title,
  tone,
  onClick,
}: ChoiceProps): JSX.Element {
  const look = selected ? (suggested ? "suggested" : "selected") : (tone ?? "idle");

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={label}
      aria-pressed={selected}
      className={cx(CHOICE_BASE, CHOICE_TONE[look])}
    >
      {children}
      {hotkey && (
        <span className="absolute top-1/2 right-1 -translate-y-1/2">
          <Kbd dim={hotkeyDim} onAccent={look === "selected"}>
            {hotkey}
          </Kbd>
        </span>
      )}
    </button>
  );
}
