import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import type { ReactNode } from "react";

import { cx, TOGGLE_PILL } from "./styles";

// A single on/off pill toggle (the grid's snap switch). For a set of mutually-exclusive or
// intersecting choices use ToggleGroup instead; this is the standalone, two-state control.
type ToggleProps = {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
  children: ReactNode;
};

export function Toggle({ pressed, onPressedChange, ariaLabel, disabled, children }: ToggleProps) {
  return (
    <BaseToggle
      pressed={pressed}
      onPressedChange={onPressedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cx(TOGGLE_PILL, "disabled:cursor-default disabled:opacity-40")}
    >
      {children}
    </BaseToggle>
  );
}
