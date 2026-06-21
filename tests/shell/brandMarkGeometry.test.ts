import { describe, expect, test } from "vitest";

import {
  ATTACK_FROM_TOP,
  ATTACK_STROKE,
  BALL_RADIUS,
  brandMarkGeometry,
  COURT_RADIUS,
  COURT_STROKE,
  MASK_SAFE_RADIUS,
} from "../../src/shell/brandMarkGeometry";

const near = (actual: number, expected: number): void => expect(actual).toBeCloseTo(expected, 4);

describe("brandMarkGeometry", () => {
  // Every absolute size is a ratio of the court side, so the same proportions hold at any frame.
  describe.each([24, 100, 152])("edge fit at frame %d", (frame) => {
    const g = brandMarkGeometry(frame);

    test("the footprint touches all four edges", () => {
      near(g.court.x - g.court.strokeWidth / 2, 0); // court's stroked left edge
      near(g.court.y + g.court.size + g.court.strokeWidth / 2, frame); // court's stroked bottom edge
      near(g.ball.cy - g.ball.radius, 0); // ball's top, breaking the corner
      near(g.ball.cx + g.ball.radius, frame); // ball's right, breaking the corner
    });

    test("strokes, radius, and ball stay in proportion to the court side", () => {
      near(g.court.strokeWidth, COURT_STROKE * g.court.size);
      near(g.court.radius, COURT_RADIUS * g.court.size);
      near(g.attackLine.strokeWidth, ATTACK_STROKE * g.court.size);
      near(g.ball.radius, BALL_RADIUS * g.court.size);
    });

    test("the attack line spans the court at a third down from the top", () => {
      near(g.attackLine.x1, g.court.x);
      near(g.attackLine.x2, g.court.x + g.court.size);
      near(g.attackLine.y1, g.court.y + ATTACK_FROM_TOP * g.court.size);
      near(g.attackLine.y2, g.attackLine.y1);
    });
  });

  describe.each([180, 192, 512])("masked fit at frame %d", (frame) => {
    const g = brandMarkGeometry(frame, { masked: true });

    test("the mark is centred", () => {
      near(g.court.x - g.court.strokeWidth / 2, frame - (g.ball.cx + g.ball.radius)); // equal left/right margins
    });

    test("the ball's outer edge lands on the maskable safe-zone radius", () => {
      const center = frame / 2;
      const reach = Math.hypot(g.ball.cx - center, g.ball.cy - center) + g.ball.radius;

      near(reach, MASK_SAFE_RADIUS * frame);
    });
  });

  test("locks the canonical edge-fit proportions at frame 100", () => {
    const g = brandMarkGeometry(100);

    near(g.court.size, 82.3045);
    near(g.court.x, 4.1152);
    near(g.court.y, 13.5802);
    near(g.ball.radius, 13.5802);
  });
});
