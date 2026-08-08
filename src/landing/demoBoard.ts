import type { Board } from "../boards/types";

// The board the landing page plays. A real three-step Sequence, built as an in-memory literal — it
// never touches Supabase, so it carries placeholder ownership fields the viewer never sees. A simple,
// legible side-out: the libero digs to the setter, the setter delivers outside, the outside hitter
// swings. Five players and the ball keep it uncluttered; only the ball crosses the net.
//
// Coordinates are normalized [0,1] over one half-court: x runs sideline to sideline, y runs net (0)
// to end line (1). A marker may sit a touch past the lines (the free zone), so the ball finishing at
// y < 0 reads as cleared over the net.

const PLACEHOLDER_TIME = 0;

export const DEMO_BOARD: Board = {
  id: "landing-demo",
  title: "Side-out to the outside",
  description: "",
  mode: "positions",
  markers: [
    { id: "li", role: "libero", label: "L" },
    { id: "s", role: "setter", label: "S" },
    { id: "oh", role: "outside", label: "OH" },
    { id: "mb", role: "middle", label: "MB" },
    { id: "opp", role: "opposite", label: "OPP" },
    { id: "ball", role: "ball" },
  ],
  steps: [
    {
      id: "reception",
      instruction: "The libero digs the serve up to the setter.",
      positions: {
        li: { x: 0.4, y: 0.78 },
        s: { x: 0.64, y: 0.22 },
        oh: { x: 0.18, y: 0.46 },
        mb: { x: 0.46, y: 0.2 },
        opp: { x: 0.82, y: 0.5 },
        ball: { x: 0.4, y: 0.66 },
      },
    },
    {
      id: "set",
      instruction: "The setter feeds the outside, who rises to swing.",
      positions: {
        li: { x: 0.4, y: 0.78 },
        s: { x: 0.64, y: 0.22 },
        oh: { x: 0.18, y: 0.46 },
        mb: { x: 0.46, y: 0.2 },
        opp: { x: 0.82, y: 0.5 },
        ball: { x: 0.56, y: 0.16 },
      },
    },
    {
      id: "attack",
      instruction: "The attack finds the floor for the side-out.",
      positions: {
        li: { x: 0.4, y: 0.78 },
        s: { x: 0.64, y: 0.22 },
        oh: { x: 0.16, y: 0.1 },
        mb: { x: 0.46, y: 0.2 },
        opp: { x: 0.82, y: 0.5 },
        ball: { x: 0.16, y: -0.06 },
      },
    },
  ],
  tags: [],
  createdBy: null,
  capability: "viewer",
  currentRevisionId: null,
  autoArrows: true,
  rotationStrict: false,
  opponentSide: false,
  createdAt: PLACEHOLDER_TIME,
  updatedAt: PLACEHOLDER_TIME,
};
