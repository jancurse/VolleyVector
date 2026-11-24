import type { JSX } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "../../ui/Button";
import { IconButton } from "../../ui/IconButton";
import { formatTime } from "../exporters";
import { STEP } from "../usePlayer";
import { Kbd } from "./Kbd";

/**
 * An entry's time to the tenth of a second, as the head of the entry. The arrows step it a tenth either way, the video
 * with it. The button puts it where the video is, for a time that is far off: find the moment in the video first.
 */
export function TimeStepper({
  time,
  onNudge,
  onStamp,
}: {
  time: number;
  onNudge: (by: number) => void;
  onStamp: () => void;
}): JSX.Element {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center rounded-md border border-border bg-panel">
        <IconButton
          variant="plain"
          size="sm"
          aria-label="Earlier"
          tooltip="0.1 s earlier (<). With Alt, half a second"
          onClick={(e) => onNudge(-(e.altKey ? 0.5 : STEP))}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </IconButton>
        <span className="min-w-16 px-1 text-center font-mono text-lg font-bold text-text tabular-nums">
          {formatTime(Math.floor(Math.round(time * 10) / 10))}.{Math.round(time * 10) % 10}
        </span>
        <IconButton
          variant="plain"
          size="sm"
          aria-label="Later"
          tooltip="0.1 s later (>). With Alt, half a second"
          onClick={(e) => onNudge(e.altKey ? 0.5 : STEP)}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </IconButton>
      </span>
      <Button variant="ghost" size="sm" title="Move this row to where the video is" onClick={onStamp}>
        Set to video time <Kbd>/</Kbd>
      </Button>
    </span>
  );
}
