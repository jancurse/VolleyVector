import { MARKER_COLORS, ROLES } from "../court/roles";
import type { Arrow } from "../court/types";
import { stepMoves } from "./operations";
import type { Board } from "./types";

// The ball's path uses a theme-adaptive neutral (see --ball-arrow in index.css) so it reads on both
// themes; a player's arrow takes that marker's own colour.
const BALL_ARROW = "var(--ball-arrow)";

/** The movement arrows leaving `step`, each coloured to its marker (the ball to a neutral). */
export function arrowsForStep(board: Board, step: number): Arrow[] {
  return stepMoves(board, step).map((move) => {
    const marker = board.markers.find((m) => m.id === move.id);
    const color =
      !marker || marker.role === "ball"
        ? BALL_ARROW
        : marker.color
          ? MARKER_COLORS[marker.color].fill
          : ROLES[marker.role].fill;

    return { from: move.from, to: move.to, color };
  });
}
