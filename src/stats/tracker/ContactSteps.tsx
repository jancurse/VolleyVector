import type { JSX } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { IconButton } from "../../ui/IconButton";

/** To the row before or after the one open in the list. */
export function ContactSteps({ onStep }: { onStep: (direction: 1 | -1) => void }): JSX.Element {
  return (
    <span className="flex">
      <IconButton
        variant="plain"
        size="sm"
        aria-label="Previous row"
        tooltip="Previous row (↑)"
        onClick={() => onStep(-1)}
      >
        <ChevronUp size={16} aria-hidden="true" />
      </IconButton>
      <IconButton variant="plain" size="sm" aria-label="Next row" tooltip="Next row (↓)" onClick={() => onStep(1)}>
        <ChevronDown size={16} aria-hidden="true" />
      </IconButton>
    </span>
  );
}
