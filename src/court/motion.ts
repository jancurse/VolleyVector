// Shared motion constants for drill playback, so the marker glide and the playback clock agree on
// timing. The easing mirrors --ease-settle in index.css.

export const EASE_SETTLE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Seconds a marker takes to glide between two steps. The playback dwell is measured against this. */
export const STEP_TRAVEL_S = 0.7;
