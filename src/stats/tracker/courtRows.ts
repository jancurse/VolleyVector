/** Court positions as seen from behind our baseline, net at the top. */
export const COURT_ROWS = [
  [4, 3, 2],
  [5, 6, 1],
];

/** The hotkey for the player at roster index `i`: 1–9, then 0, then none. */
export const playerKey = (i: number): string | null => (i < 9 ? String(i + 1) : i === 9 ? "0" : null);
