import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useMemo } from "react";
import type { JSX } from "react";
import ReactMarkdown from "react-markdown";

import { arrowsForStep } from "../boards/arrows";
import { stepMarkers } from "../boards/operations";
import type { Board } from "../boards/types";
import { isSequence } from "../boards/types";
import { useBoardPlayback } from "../boards/useBoardPlayback";
import { Court } from "../court/Court";
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

// The read-only surface for one board, what players and share-link visitors get. A Position renders a
// single static court and its description; a Sequence renders the animated court with a transport and
// a step scrubber, plus the current step's instruction (markdown) below the description. A coach lands
// here before choosing to edit.
type BoardViewProps = {
  board: Board;
  onEdit: () => void;
  onBack: () => void;
};

export function BoardView({ board, onEdit, onBack }: BoardViewProps): JSX.Element {
  const sequence = isSequence(board);
  const playback = useBoardPlayback(board.steps.length);
  const { step, playing, atEnd } = playback;

  const markers = useMemo(() => stepMarkers(board, step), [board, step]);
  // Arrows preview the upcoming move while paused; during play the motion itself shows the path.
  const arrows = useMemo(() => (playing ? [] : arrowsForStep(board, step)), [board, step, playing]);
  const instruction = board.steps[step]?.instruction ?? "";

  return (
    <MotionConfig reducedMotion="user">
      <div className="vc-view">
        <button type="button" className="vc-back" onClick={onBack}>
          ← Library
        </button>
        <div className="vc-view-bar">
          <div className="vc-caption">
            <p className="vc-eyebrow">{sequence ? "Sequence" : "Position"}</p>
            <h1 className="vc-view-title">{board.title || "Untitled board"}</h1>
          </div>
          <button type="button" className="vc-primary" onClick={onEdit}>
            Edit
          </button>
        </div>

        {sequence ? (
          <div className="vc-view-body">
            <div className="vc-drill-stage">
              <figure className="vc-court-frame">
                <Court animated markers={markers} arrows={arrows} label={board.title || "Untitled board"} />
              </figure>

              <div className="vc-transport">
                <button
                  type="button"
                  className="vc-transport-btn"
                  onClick={playback.prev}
                  disabled={step === 0}
                  aria-label="Previous step"
                >
                  {PREV_ICON}
                </button>
                <button
                  type="button"
                  className="vc-transport-btn vc-transport-play"
                  onClick={playback.toggle}
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? PAUSE_ICON : PLAY_ICON}
                </button>
                <button
                  type="button"
                  className="vc-transport-btn"
                  onClick={playback.next}
                  disabled={atEnd}
                  aria-label="Next step"
                >
                  {NEXT_ICON}
                </button>
                <span className="vc-transport-count">
                  {step + 1} / {board.steps.length}
                </span>
              </div>

              <StepStrip steps={board.steps} current={step} onSelect={playback.goTo} />
            </div>

            <div className="vc-drill-side">
              <section className="vc-desc vc-view-desc" aria-label="Description">
                <div className="vc-desc-head">
                  <span className="vc-panel-title">Description</span>
                </div>
                {board.description.trim() ? (
                  <div className="vc-markdown">
                    <ReactMarkdown>{board.description}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="vc-muted">No description yet.</p>
                )}
              </section>

              <section className="vc-desc vc-step-note" aria-label="Step instruction">
                <div className="vc-desc-head">
                  <span className="vc-panel-title">Step {step + 1}</span>
                </div>
                <div className="vc-step-note-body" aria-live="polite">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={step}
                      className="vc-markdown"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22 }}
                    >
                      {instruction.trim() ? (
                        <ReactMarkdown>{instruction}</ReactMarkdown>
                      ) : (
                        <p className="vc-muted">No instruction for this step.</p>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </section>
            </div>
          </div>
        ) : (
          <div className="vc-view-body">
            <figure className="vc-court-frame">
              <Court markers={markers} label={board.title || "Untitled board"} />
            </figure>

            <section className="vc-desc vc-view-desc" aria-label="Description">
              <div className="vc-desc-head">
                <span className="vc-panel-title">Description</span>
              </div>
              {board.description.trim() ? (
                <div className="vc-markdown">
                  <ReactMarkdown>{board.description}</ReactMarkdown>
                </div>
              ) : (
                <p className="vc-muted">No description yet.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
