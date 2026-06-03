import { useCallback, useEffect, useState } from "react";

import { STEP_TRAVEL_S } from "../court/motion";

// Drives stepping and continuous playback of a drill. Markers glide via Motion whenever the shown
// step changes, so this hook only decides which step is shown and, while playing, advances on a
// clock: each advance allows the glide (STEP_TRAVEL_S) plus a dwell to read the new step.

const DWELL_MS = 1100;
const ADVANCE_MS = STEP_TRAVEL_S * 1000 + DWELL_MS;

export type Playback = {
  /** The step currently shown (markers glide toward it). */
  step: number;
  playing: boolean;
  atEnd: boolean;
  /** Start playing; from the end it replays from the first step. */
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Jump to a step (pauses playback). */
  goTo: (step: number) => void;
  next: () => void;
  prev: () => void;
};

export function useDrillPlayback(stepCount: number): Playback {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const last = Math.max(0, stepCount - 1);
  const atEnd = step >= last;

  // While playing, advance one step at a time; landing on the last step stops playback. The advance
  // and the stop both happen in the timer callback, so the effect itself never sets state.
  useEffect(() => {
    if (!playing || step >= last) return;

    const next = step + 1;
    const handle = setTimeout(() => {
      setStep(next);
      if (next >= last) setPlaying(false);
    }, ADVANCE_MS);

    return () => clearTimeout(handle);
  }, [playing, step, last]);

  const goTo = useCallback(
    (next: number) => {
      setPlaying(false);
      setStep(Math.max(0, Math.min(next, last)));
    },
    [last]
  );

  const play = useCallback(() => {
    setStep((s) => (s >= last ? 0 : s));
    setPlaying(true);
  }, [last]);

  return {
    step: Math.min(step, last),
    playing,
    atEnd,
    play,
    pause: useCallback(() => setPlaying(false), []),
    toggle: useCallback(() => (playing ? setPlaying(false) : play()), [playing, play]),
    goTo,
    next: useCallback(() => goTo(step + 1), [goTo, step]),
    prev: useCallback(() => goTo(step - 1), [goTo, step]),
  };
}
