import { describe, expect, test } from "vitest";

import { arrowsForStep } from "../../src/boards/arrows";
import type { Board } from "../../src/boards/types";
import { ROLES } from "../../src/court/roles";

// A two-step board where both an outside hitter and the ball travel far enough to draw an arrow, so
// the step's derived arrows carry one of each kind.
const BOARD: Board = {
  id: "b",
  title: "",
  description: "",
  mode: "positions",
  markers: [
    { id: "oh", role: "outside", label: "OH" },
    { id: "ball", role: "ball" },
  ],
  steps: [
    { id: "s1", instruction: "", positions: { oh: { x: 0.2, y: 0.5 }, ball: { x: 0.5, y: 0.1 } } },
    { id: "s2", instruction: "", positions: { oh: { x: 0.7, y: 0.5 }, ball: { x: 0.5, y: 0.6 } } },
  ],
  tags: [],
  createdBy: null,
  capability: "owner",
  currentRevisionId: null,
  autoArrows: true,
  rotationStrict: false,
  opponentSide: false,
  createdAt: 0,
  updatedAt: 0,
};

describe("arrowsForStep", () => {
  const arrows = arrowsForStep(BOARD, 0);
  const ball = arrows.find((a) => a.dashed);
  const player = arrows.find((a) => !a.dashed);

  test("the ball's path is dashed in the neutral colour", () => {
    expect(ball).toEqual(expect.objectContaining({ dashed: true, color: "var(--ball-arrow)" }));
  });

  test("a player's move is solid in its role colour", () => {
    expect(player).toEqual(expect.objectContaining({ dashed: false, color: ROLES.outside.fill }));
  });
});
