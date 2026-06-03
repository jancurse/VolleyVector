import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useMemo } from "react";
import type { JSX } from "react";
import ReactMarkdown from "react-markdown";

import { Court } from "../court/Court";
import { arrowsForStep } from "../drills/arrows";
import { stepMarkers } from "../drills/operations";
import type { Drill } from "../drills/types";
import { useDrillPlayback } from "../drills/useDrillPlayback";
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

// The read-only playback surface for a drill: the same court, animated, with a transport and a step
// scrubber under it, and the description plus the current step's instruction (markdown) alongside.
// Players and share-link visitors get this view.
type DrillViewProps = {
  drill: Drill;
  onEdit: () => void;
  onBack: () => void;
};

export function DrillView({ drill, onEdit, onBack }: DrillViewProps): JSX.Element {
  const playback = useDrillPlayback(drill.steps.length);
  const { step, playing, atEnd } = playback;

  const markers = useMemo(() => stepMarkers(drill, step), [drill, step]);
  // Arrows preview the upcoming move while paused; during play the motion itself shows the path.
  const arrows = useMemo(() => (playing ? [] : arrowsForStep(drill, step)), [drill, step, playing]);
  const instruction = drill.steps[step]?.instruction ?? "";

  return (
    <MotionConfig reducedMotion="user">
      <div className="vc-view">
        <button type="button" className="vc-back" onClick={onBack}>
          ← Library
        </button>
        <div className="vc-view-bar">
          <div className="vc-caption">
            <p className="vc-eyebrow">Drill</p>
            <h1 className="vc-view-title">{drill.title || "Untitled drill"}</h1>
          </div>
          <button type="button" className="vc-primary" onClick={onEdit}>
            Edit
          </button>
        </div>

        <div className="vc-view-body">
          <div className="vc-drill-stage">
            <figure className="vc-court-frame">
              <Court animated markers={markers} arrows={arrows} label={drill.title || "Untitled drill"} />
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
                {step + 1} / {drill.steps.length}
              </span>
            </div>

            <StepStrip steps={drill.steps} current={step} onSelect={playback.goTo} />
          </div>

          <div className="vc-drill-side">
            <section className="vc-desc vc-view-desc" aria-label="Description">
              <div className="vc-desc-head">
                <span className="vc-panel-title">Description</span>
              </div>
              {drill.description.trim() ? (
                <div className="vc-markdown">
                  <ReactMarkdown>{drill.description}</ReactMarkdown>
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
      </div>
    </MotionConfig>
  );
}
