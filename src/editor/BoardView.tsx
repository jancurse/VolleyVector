import { MotionConfig } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { JSX, ReactNode } from "react";

import { arrowsForStep } from "../boards/arrows";
import { stepMarkers } from "../boards/operations";
import type { Board } from "../boards/types";
import { isSequence } from "../boards/types";
import { useBoardPlayback } from "../boards/useBoardPlayback";
import { Court } from "../court/Court";
import { Button } from "../ui/Button";
import { CourtFrame } from "../ui/CourtFrame";
import { Markdown } from "../ui/Markdown";
import { Toolbar, ToolbarButton } from "../ui/Toolbar";
import { EYEBROW, MUTED, PANEL, PANEL_TITLE, TITLE, cx } from "../ui/styles";
import { StepStrip } from "./StepStrip";

const PLAY_ICON = (
  <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
    <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
  </svg>
);

const PAUSE_ICON = (
  <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
    <rect x={6.5} y={5} width={4} height={14} rx={1.2} fill="currentColor" />
    <rect x={13.5} y={5} width={4} height={14} rx={1.2} fill="currentColor" />
  </svg>
);

const PREV_ICON = (
  <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
    <path
      d="M15 6l-6 6 6 6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const NEXT_ICON = (
  <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
    <path
      d="M9 6l6 6-6 6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const VIEW_BODY =
  "grid grid-cols-[min(74vh,560px)_minmax(0,1fr)] items-start gap-[clamp(1.25rem,3vw,2.5rem)] max-[1040px]:grid-cols-[minmax(0,1fr)]";

function DescriptionPanel({ markdown }: { markdown: string }): JSX.Element {
  return (
    <section className={cx(PANEL, "min-w-0")} aria-label="Description">
      <span className={PANEL_TITLE}>Description</span>
      {markdown.trim() ? <Markdown>{markdown}</Markdown> : <p className={MUTED}>No description yet.</p>}
    </section>
  );
}

// The read-only surface for one board, what players and share-link visitors get. A Position renders a
// single static court and its description; a Sequence renders the animated court with a transport and
// a step scrubber, plus the current step's instruction (markdown) below the description. A coach lands
// here before choosing to edit.
type BoardViewProps = {
  board: Board;
  /** Whether the current user may edit this board (a coach of its team or an admin, lock permitting). */
  canEdit: boolean;
  /** Whether the current user may set or clear the author lock (the board's author, or an admin). */
  canSetLock: boolean;
  onToggleLock: () => void;
  onEdit: () => void;
  onBack: () => void;
  /** Label for the back button. Defaults to the library; the share page overrides it. */
  backLabel?: string;
  /** Extra action buttons for the header bar (sharing, copying, promoting), injected by the caller. */
  actions?: ReactNode;
};

export function BoardView({
  board,
  canEdit,
  canSetLock,
  onToggleLock,
  onEdit,
  onBack,
  backLabel = "← Library",
  actions,
}: BoardViewProps): JSX.Element {
  const sequence = isSequence(board);
  const playback = useBoardPlayback(board.steps.length);
  const { step, playing, atEnd } = playback;

  const markers = useMemo(() => stepMarkers(board, step), [board, step]);
  // Arrows preview the upcoming move while paused; during play the motion itself shows the path.
  const arrows = useMemo(() => (playing ? [] : arrowsForStep(board, step)), [board, step, playing]);
  const instruction = board.steps[step]?.instruction ?? "";

  // The instruction changing reads as a move between two notes: the incoming one slides in from the
  // direction of travel. Track the previously shown step in state and adjust the direction during the
  // render where it changes, so no ref is read during render.
  const [prevStep, setPrevStep] = useState(step);
  const [stepDirection, setStepDirection] = useState("animate-step-fwd");

  if (prevStep !== step) {
    setPrevStep(step);
    setStepDirection(step < prevStep ? "animate-step-back" : "animate-step-fwd");
  }

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const id = window.setTimeout(() => setCopied(false), 1500);

    return () => window.clearTimeout(id);
  }, [copied]);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(board, null, 2));
      setCopied(true);
    } catch {
      // The clipboard call can reject (no permission or an insecure context); keep the view intact.
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-[clamp(1rem,3vh,1.75rem)] animate-rise motion-reduce:animate-none">
        <Button variant="text" size="sm" className="self-start pl-0" onClick={onBack}>
          {backLabel}
        </Button>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className={EYEBROW}>{sequence ? "Sequence" : "Position"}</p>
            <h1 className={TITLE}>{board.title || "Untitled board"}</h1>
          </div>
          <div className="flex flex-none items-center gap-2">
            {actions}
            <Button variant="ghost" onClick={copyJson}>
              {copied ? "Copied" : "Copy JSON"}
            </Button>
            {canSetLock && (
              <Button variant="ghost" onClick={onToggleLock}>
                {board.authorLocked ? "Unlock editing" : "Lock editing"}
              </Button>
            )}
            {canEdit && (
              <Button variant="primary" onClick={onEdit}>
                Edit
              </Button>
            )}
          </div>
        </div>

        {sequence ? (
          <div className={VIEW_BODY}>
            <div className="flex min-w-0 flex-col items-center gap-[clamp(0.7rem,2vh,1.15rem)]">
              <CourtFrame className="max-[1040px]:justify-self-center">
                <Court animated markers={markers} arrows={arrows} label={board.title || "Untitled board"} />
              </CourtFrame>

              <Toolbar ariaLabel="Playback" className="gap-[0.55rem]">
                <ToolbarButton
                  icon={{ variant: "control", size: "md" }}
                  aria-label="Previous step"
                  tooltip="Previous step"
                  onClick={playback.prev}
                  disabled={step === 0}
                >
                  {PREV_ICON}
                </ToolbarButton>
                <ToolbarButton
                  icon={{ variant: "accent", size: "lg" }}
                  aria-label={playing ? "Pause" : "Play"}
                  tooltip={playing ? "Pause" : "Play"}
                  onClick={playback.toggle}
                >
                  {playing ? PAUSE_ICON : PLAY_ICON}
                </ToolbarButton>
                <ToolbarButton
                  icon={{ variant: "control", size: "md" }}
                  aria-label="Next step"
                  tooltip="Next step"
                  onClick={playback.next}
                  disabled={atEnd}
                >
                  {NEXT_ICON}
                </ToolbarButton>
                <span className="ml-[0.35rem] min-w-[3ch] font-mono text-sm text-text-dim">
                  {step + 1} / {board.steps.length}
                </span>
              </Toolbar>

              <StepStrip steps={board.steps} current={step} onSelect={playback.goTo} />
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <DescriptionPanel markdown={board.description} />

              <section className={cx(PANEL, "min-w-0")} aria-label="Step instruction">
                <span className={PANEL_TITLE}>Step {step + 1}</span>
                <div className="min-h-[3.25rem]" aria-live="polite">
                  <div key={step} className={cx(stepDirection, "motion-reduce:animate-none")}>
                    {instruction.trim() ? (
                      <Markdown>{instruction}</Markdown>
                    ) : (
                      <p className={MUTED}>No instruction for this step.</p>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        ) : (
          <div className={VIEW_BODY}>
            <CourtFrame className="max-[1040px]:justify-self-center">
              <Court markers={markers} label={board.title || "Untitled board"} />
            </CourtFrame>
            <DescriptionPanel markdown={board.description} />
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
