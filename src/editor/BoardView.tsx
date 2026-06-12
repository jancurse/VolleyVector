import { MotionConfig } from "motion/react";
import { useMemo, useState } from "react";
import type { JSX, ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

import { arrowsForStep } from "../boards/arrows";
import { stepAnnotations, stepMarkers } from "../boards/operations";
import { rotationAssignment, rotationLabel, rotationViolations, violationFlags } from "../boards/rotation";
import type { RotationViolation } from "../boards/rotation";
import type { Board, StepRotation } from "../boards/types";
import { isSequence } from "../boards/types";
import { useBoardPlayback } from "../boards/useBoardPlayback";
import { Court } from "../court/Court";
import { Button } from "../ui/Button";
import { CourtFrame } from "../ui/CourtFrame";
import { Markdown } from "../ui/Markdown";
import { Toolbar, ToolbarButton } from "../ui/Toolbar";
import { EYEBROW, MUTED, PANEL, PANEL_TITLE, TAG_CHIP, TITLE, cx } from "../ui/styles";
import { RotationBoard } from "./RotationBoard";
import { violationMessages } from "./RotationPanel";
import { StepStrip } from "./StepStrip";

const PLAY_ICON = <Play size={20} fill="currentColor" aria-hidden="true" />;

const PAUSE_ICON = <Pause size={20} fill="currentColor" aria-hidden="true" />;

const PREV_ICON = <ChevronLeft size={18} strokeWidth={2.2} aria-hidden="true" />;

const NEXT_ICON = <ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" />;

const VIEW_BODY =
  "grid grid-cols-[min(74vh,620px)_minmax(0,1fr)] items-start gap-[clamp(1.25rem,3vw,2.5rem)] max-[1040px]:grid-cols-[minmax(0,1fr)]";

// The rotation board and its label, visible whenever the shown step's rotation is active. The label
// stays visible while the board itself collapses (no hover reveal: hover does not exist on touch).
function RotationViewPanel({
  board,
  rotation,
  violations,
}: {
  board: Board;
  rotation: StepRotation;
  violations: readonly RotationViolation[];
}): JSX.Element {
  return (
    <details open className={cx(PANEL, "group min-w-0")}>
      <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
        <span className={PANEL_TITLE}>{rotationLabel(rotation)}</span>
        {violationMessages(violations).map((message) => (
          <span key={message} className="text-sm font-semibold text-warn">
            {message}
          </span>
        ))}
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="ml-auto text-text-dim transition-transform duration-150 ease-settle group-open:rotate-180"
        />
      </summary>
      <div className="w-full max-w-[260px] self-center">
        <RotationBoard markers={board.markers} rotation={rotation} />
      </div>
    </details>
  );
}

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
// a step scrubber, plus the current step's instruction (markdown) below the description. The board's
// actions sit beside the title, like every other surface's content header: the app injects the overflow
// menu and Edit; the share page injects its copy and promote affordances.
type BoardViewProps = {
  board: Board;
  onBack: () => void;
  /** Label for the back button. Defaults to the library; the share page overrides it. */
  backLabel?: string;
  /** Action buttons for the title row (the app's edit/share cluster, or the share page's copying). */
  actions?: ReactNode;
};

export function BoardView({ board, onBack, backLabel = "← Library", actions }: BoardViewProps): JSX.Element {
  const sequence = isSequence(board);
  const playback = useBoardPlayback(board.steps.length);
  const { step, playing, atEnd } = playback;

  const markers = useMemo(() => stepMarkers(board, step), [board, step]);
  const annotations = useMemo(() => stepAnnotations(board, step), [board, step]);
  // Arrows preview the upcoming move while paused; during play the motion itself shows the path. The
  // board-level toggle hides them entirely; manual arrow annotations are unaffected.
  const arrows = useMemo(
    () => (playing || !board.autoArrows ? [] : arrowsForStep(board, step)),
    [board, step, playing]
  );
  const instruction = board.steps[step]?.instruction ?? "";

  // The shown step's rotation, resolved: when active it drives the rotation panel and the court's
  // violation flags (shown here too — an illegal arrangement may be deliberately authored).
  const rotation = board.steps[step]?.rotation;
  const assignment = useMemo(() => rotationAssignment(board.markers, rotation), [board.markers, rotation]);
  const violations = useMemo(
    () => (assignment ? rotationViolations(assignment, board.steps[step].positions, board.markers) : []),
    [assignment, board, step]
  );
  const warnings = assignment && violations.length > 0 ? violationFlags(assignment, violations) : undefined;
  const rotationPanel = rotation && assignment && (
    <RotationViewPanel board={board} rotation={rotation} violations={violations} />
  );

  // The instruction changing reads as a move between two notes: the incoming one slides in from the
  // direction of travel. Track the previously shown step in state and adjust the direction during the
  // render where it changes, so no ref is read during render.
  const [prevStep, setPrevStep] = useState(step);
  const [stepDirection, setStepDirection] = useState("animate-step-fwd");

  if (prevStep !== step) {
    setPrevStep(step);
    setStepDirection(step < prevStep ? "animate-step-back" : "animate-step-fwd");
  }

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
            {board.tags.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {board.tags.map((tag) => (
                  <span key={tag} className={TAG_CHIP}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          {actions && <div className="flex flex-none items-center gap-2">{actions}</div>}
        </div>

        {sequence ? (
          <div className={VIEW_BODY}>
            <div className="flex min-w-0 flex-col items-center gap-[clamp(0.7rem,2vh,1.15rem)]">
              <CourtFrame className="max-[1040px]:justify-self-center">
                <Court
                  animated
                  markers={markers}
                  arrows={arrows}
                  annotations={annotations}
                  warnings={warnings}
                  label={board.title || "Untitled board"}
                />
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
              {rotationPanel && (
                <div key={`rotation-${step}`} className={cx(stepDirection, "motion-reduce:animate-none")}>
                  {rotationPanel}
                </div>
              )}
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
              <Court
                markers={markers}
                annotations={annotations}
                warnings={warnings}
                label={board.title || "Untitled board"}
              />
            </CourtFrame>
            <div className="flex min-w-0 flex-col gap-4">
              {rotationPanel}
              <DescriptionPanel markdown={board.description} />
            </div>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
