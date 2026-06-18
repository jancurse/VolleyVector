import { MARKER_COLORS, ROLES } from "../court/roles";
import type { Arrow } from "../court/types";
import { stepMoves } from "./operations";
import type { Board } from "./types";

// The ball's path uses a theme-adaptive neutral (see --ball-arrow in index.css) so it reads on both
// themes; a player's arrow takes that marker's own colour.
const BALL_ARROW = "var(--ball-arrow)";

/** The movement arrows leaving `step`: a player move solid in its role colour, a ball path dashed in
 *  the neutral, so a ball run and a player run never read as the same kind of move. */
export function arrowsForStep(board: Board, step: number): Arrow[] {
  return stepMoves(board, step).map((move) => {
    const marker = board.markers.find((m) => m.id === move.id);
    const isBall = !marker || marker.role === "ball";
    const color = isBall ? BALL_ARROW : marker.color ? MARKER_COLORS[marker.color].fill : ROLES[marker.role].fill;

    return { from: move.from, to: move.to, color, dashed: isBall };
  });
}
