import type { Board } from "../boards/types";
import type { NormalizedPoint } from "../court/geometry";

// In-memory boards the landing page showcases, copied from the Inspiration content. Nothing touches
// Supabase, so the server-owned fields carry placeholders the viewer never sees. Coordinates are
// normalized [0,1] over one half-court; a ball at y < 0 reads as cleared over the net.

const PLACEHOLDER_TIME = 0;

const base = {
  description: "",
  tags: [] as string[],
  createdBy: null,
  capability: "viewer" as const,
  currentRevisionId: null,
  rotationStrict: false,
  createdAt: PLACEHOLDER_TIME,
  updatedAt: PLACEHOLDER_TIME,
} satisfies Partial<Board>;

// A four-step serve-receive sideout: receive, pass to the middle, set to the antenna, outside attacks.
export const DRILL_BOARD: Board = {
  ...base,
  id: "landing-drill",
  title: "Serve receive & attack",
  description: "Rotation 2 sideout drill",
  mode: "positions",
  autoArrows: true,
  markers: [
    { id: "s", role: "setter", label: "S" },
    { id: "opp", role: "opposite", label: "OPP" },
    { id: "mb1", role: "middle", label: "MB1" },
    { id: "oh1", role: "outside", label: "OH1" },
    { id: "oh2", role: "outside", label: "OH2" },
    { id: "l", role: "libero", label: "L" },
    { id: "ball", role: "ball" },
  ],
  steps: [
    {
      id: "step-1",
      instruction: "Rotation 2 serve receive: OH1 and the libero take the wings, OH2 the seam.",
      positions: {
        s: { x: 0.8, y: 0.16 },
        opp: { x: 0.38, y: 0.84 },
        mb1: { x: 0.04, y: 0.293 },
        oh1: { x: 0.16, y: 0.6 },
        oh2: { x: 0.4, y: 0.7 },
        l: { x: 0.7, y: 0.66 },
        ball: { x: 0.55, y: -0.09 },
      },
    },
    {
      id: "step-2",
      instruction: "Pass to the setter at the net. OH1 kicks out wide as the opposite peels right behind the passers.",
      positions: {
        s: { x: 0.55, y: 0.12 },
        opp: { x: 0.86, y: 0.82 },
        mb1: { x: 0.39, y: 0.29 },
        oh1: { x: 0.04, y: 0.46 },
        oh2: { x: 0.5, y: 0.66 },
        l: { x: 0.68, y: 0.62 },
        ball: { x: 0.52, y: 0.66 },
      },
    },
    {
      id: "step-3",
      instruction:
        "Set to the antenna. The middle jumps with it as the opposite loads a back-row approach on the right.",
      positions: {
        s: { x: 0.6, y: 0.085 },
        opp: { x: 0.96, y: 0.55 },
        mb1: { x: 0.5, y: 0.085 },
        oh1: { x: -0.05, y: 0.28 },
        oh2: { x: 0.28, y: 0.6 },
        l: { x: 0.48, y: 0.34 },
        ball: { x: 0.55, y: 0.085 },
      },
    },
    {
      id: "step-4",
      instruction:
        "OH1 attacks and everyone covers: libero, middle and setter tight, OH2 behind, the opposite deep right.",
      positions: {
        s: { x: 0.42, y: 0.16 },
        opp: { x: 0.76, y: 0.5 },
        mb1: { x: 0.22, y: 0.12 },
        oh1: { x: 0.05, y: 0.08 },
        oh2: { x: 0.28, y: 0.55 },
        l: { x: 0.08, y: 0.22 },
        ball: { x: 0.05, y: 0.05 },
      },
    },
  ],
};

// A single perimeter-defence position against an outside attack.
export const DEFENCE_BOARD: Board = {
  ...base,
  id: "landing-defence",
  title: "Base defence",
  description: [
    "Defensive position against an outside attack.",
    "",
    "**Cross Block**",
    "",
    "- **Setter:** Foot on side-line. Main target is the hard line hit. Ready for tips.",
    "- **OH2:** Deep inside the block. Main target: everything high off the block and long line shots.",
    "- **Lib:** Just outside the block shadow. Main target is the cross power hit.",
    "- **OH1:** Defending sharp hits and/or tips to the middle of court.",
  ].join("\n"),
  mode: "positions",
  autoArrows: false,
  markers: [
    { id: "opp", role: "opposite", label: "OPP" },
    { id: "mb1", role: "middle", label: "MB1" },
    { id: "oh1", role: "outside", label: "OH1" },
    { id: "s", role: "setter", label: "S" },
    { id: "l", role: "libero", label: "L" },
    { id: "oh2", role: "outside", label: "OH2" },
    { id: "ball", role: "ball" },
  ],
  steps: [
    {
      id: "step-1",
      instruction: "",
      positions: {
        opp: { x: 0.89, y: 0.05 },
        mb1: { x: 0.82, y: 0.05 },
        oh1: { x: 0.14, y: 0.31 },
        s: { x: 0.95, y: 0.6 },
        l: { x: 0.18, y: 0.72 },
        oh2: { x: 0.72, y: 0.92 },
        ball: { x: 0.95, y: -0.09 },
      },
    },
  ],
};

// The rotation board, a single legal 5-1 base. RotationShowcase plays it as a coach editing live:
// the overlap is recomputed every frame off the positions below, never authored here. The ball holds
// over the net through every beat.
const ROTATION_1 = { kind: "preset", rotation: 1 } as const;

// The opening 5-1 rotation 1: a legal base. Slot order (preset) is 1=S, 2=OH1, 3=MB, 4=OPP, 5=OH2,
// 6=LIB. The ball sits over the net (the serve) and holds there through every beat.
const BALL = { x: 0.5, y: -0.05 };
const BASE_POS: Record<string, NormalizedPoint> = {
  s: { x: 0.91, y: 0.82 },
  mb: { x: 0.52, y: 0.08 },
  lib: { x: 0.57, y: 0.76 },
  oh1: { x: 0.83, y: 0.7 },
  oh2: { x: 0.26, y: 0.76 },
  opp: { x: 0.08, y: 0.3 },
  ball: BALL,
};

export const ROTATION_BOARD: Board = {
  ...base,
  id: "landing-rotation",
  title: "5-1: Rotation 1",
  mode: "positions",
  autoArrows: false,
  markers: [
    { id: "s", role: "setter" },
    { id: "oh1", role: "outside", label: "OH1" },
    { id: "oh2", role: "outside", label: "OH2" },
    { id: "mb", role: "middle", label: "MB" },
    { id: "opp", role: "opposite" },
    { id: "lib", role: "libero" },
    { id: "ball", role: "ball" },
  ],
  steps: [{ id: "legal", instruction: "", positions: BASE_POS, rotation: ROTATION_1 }],
};

// The opposite-receives variation, still legal. The three passers spread across the back at roughly
// the hero drill's receive depth: the opposite takes the left a touch shallower and inside a sixth of
// the way in, while OH2 (middle) and the libero (right) sit a little deeper and cover more than a
// third each. OH1 and the setter stack at the net (the setter behind OH1 and right of the libero, as
// the overlap rules require). The middle holds its base spot; the ball holds over the net.
const RECEIVE_POS: Record<string, NormalizedPoint> = {
  s: { x: 0.8, y: 0.14 },
  oh1: { x: 0.9, y: 0.1 },
  mb: BASE_POS.mb,
  opp: { x: 0.12, y: 0.6 },
  oh2: { x: 0.42, y: 0.72 },
  lib: { x: 0.74, y: 0.7 },
  ball: BALL,
};

// The build, one player at a time, in order: OH1, then the setter, then the libero, then OH2, then
// the opposite. Each state moves one marker from the base to its receive spot; the middle never moves.
const STEP_OH1: Record<string, NormalizedPoint> = { ...BASE_POS, oh1: RECEIVE_POS.oh1 };
const STEP_S: Record<string, NormalizedPoint> = { ...STEP_OH1, s: RECEIVE_POS.s };
const STEP_L: Record<string, NormalizedPoint> = { ...STEP_S, lib: RECEIVE_POS.lib };
const STEP_OH2: Record<string, NormalizedPoint> = { ...STEP_L, oh2: RECEIVE_POS.oh2 };

// The fault: the setter nudged just left of the libero (x 0.8 → 0.7, the libero at 0.74), breaking the
// 6–1 side-order overlap. Only the setter moves a little, so exactly one pair (libero–setter) trips.
const FAULT_POS: Record<string, NormalizedPoint> = { ...RECEIVE_POS, s: { x: 0.7, y: 0.14 } };

const TITLE_BASE = "5-1: Rotation 1";
const TITLE_ALT = "Rotation 1: Opposite receives";
const DESC_BASE =
  "OH1 receives on the right side, with OH2 and Libero taking most of the court and the Setter tucked behind OH1.";
const DESC_ALT = "Opposite in reception with Libero and OH2 covering more court. OH1 and Setter stack in Zone 2.";

/** Where the coach's pointer rests for a beat. A UI anchor (`edit`/`done`/`title`/`desc`), a marker by
 *  id (the pointer rides the marker as it moves), or `park` just off the surface. The showcase resolves
 *  each to a live pixel point and glides the pointer there. */
export type CursorTarget = "edit" | "done" | "title" | "desc" | "park" | (string & {});

/** One beat of the rotation showcase: a single still of a coach driving the real board surfaces, the
 *  frames between eased automatically. `mode` is the surface shown — the read-only view (eyebrow,
 *  title, Edit) or the editor (title field, Done, rotation card, description). It settles on a lineup
 *  (`positions`), easing there from the previous beat when `move`, else holding. `title`/`description`
 *  are the editor fields, each optionally mid-type (`titleTyping`/`descTyping` delete the previous
 *  beat's text then type this beat's). `selectedId` is the player the coach has tapped, lighting its
 *  overlap edges (blue cues, red faults) the way clicking a disc does in the app. `cursor` is where the
 *  pointer rests; `press` flashes a click (Edit/Done), `grab` shows it holding a dragged player.
 *  `rest` marks the still the reduced-motion view holds. */
export type RotationBeat = {
  ms: number;
  positions: Record<string, NormalizedPoint>;
  move: boolean;
  mode: "view" | "edit";
  title: string;
  titleTyping?: boolean;
  description: string;
  descTyping?: boolean;
  selectedId: string | null;
  cursor: CursorTarget;
  press?: boolean;
  grab?: boolean;
  rest?: boolean;
};

// The receive build, one player at a time in service order: OH1, the setter, the libero, OH2, the
// opposite. Each move pairs with a tap one beat earlier, so the player's overlap lines light as the
// coach picks it up and then ride along through the drag. Every intermediate lineup stays legal.
const REACH = (positions: Record<string, NormalizedPoint>, id: string): RotationBeat => ({
  ms: 520,
  positions,
  move: false,
  mode: "edit",
  title: TITLE_ALT,
  description: DESC_ALT,
  selectedId: id,
  cursor: id,
});
const DRAG = (positions: Record<string, NormalizedPoint>, id: string): RotationBeat => ({
  ms: 1080,
  positions,
  move: true,
  mode: "edit",
  title: TITLE_ALT,
  description: DESC_ALT,
  selectedId: id,
  cursor: id,
  grab: true,
});

// The loop, ~27s, told almost entirely through the cursor and the lines. The coach opens the board,
// clicks Edit, retypes the title and description (the live field glows), drags the five receivers in
// one at a time — each tapped first so its blue cue edges show — then taps the setter, nudges it into
// the libero (the edge flares red), pulls it back legal, and clicks Done. The view settles on the
// finished lineup, then the board resets to replay.
export const ROTATION_SCRIPT: readonly RotationBeat[] = [
  // Open: the pointer slides in and clicks Edit.
  {
    ms: 700,
    positions: BASE_POS,
    move: false,
    mode: "view",
    title: TITLE_BASE,
    description: DESC_BASE,
    selectedId: null,
    cursor: "park",
  },
  {
    ms: 1300,
    positions: BASE_POS,
    move: false,
    mode: "view",
    title: TITLE_BASE,
    description: DESC_BASE,
    selectedId: null,
    cursor: "edit",
  },
  {
    ms: 700,
    positions: BASE_POS,
    move: false,
    mode: "view",
    title: TITLE_BASE,
    description: DESC_BASE,
    selectedId: null,
    cursor: "edit",
    press: true,
  },
  // Rename the board, then rewrite its description; the field being typed glows.
  {
    ms: 800,
    positions: BASE_POS,
    move: false,
    mode: "edit",
    title: TITLE_BASE,
    description: DESC_BASE,
    selectedId: null,
    cursor: "title",
  },
  {
    ms: 1900,
    positions: BASE_POS,
    move: false,
    mode: "edit",
    title: TITLE_ALT,
    titleTyping: true,
    description: DESC_BASE,
    selectedId: null,
    cursor: "title",
  },
  {
    ms: 800,
    positions: BASE_POS,
    move: false,
    mode: "edit",
    title: TITLE_ALT,
    description: DESC_BASE,
    selectedId: null,
    cursor: "desc",
  },
  {
    ms: 2100,
    positions: BASE_POS,
    move: false,
    mode: "edit",
    title: TITLE_ALT,
    description: DESC_ALT,
    descTyping: true,
    selectedId: null,
    cursor: "desc",
  },
  // Drag the five receivers in, each tapped (its cue edges light) then dragged.
  REACH(BASE_POS, "oh1"),
  DRAG(STEP_OH1, "oh1"),
  REACH(STEP_OH1, "s"),
  DRAG(STEP_S, "s"),
  REACH(STEP_S, "lib"),
  DRAG(STEP_L, "lib"),
  REACH(STEP_L, "oh2"),
  DRAG(STEP_OH2, "oh2"),
  REACH(STEP_OH2, "opp"),
  DRAG(RECEIVE_POS, "opp"),
  // Tap the setter: its blue cue edges to OH1 and the libero light up.
  {
    ms: 1500,
    positions: RECEIVE_POS,
    move: false,
    mode: "edit",
    title: TITLE_ALT,
    description: DESC_ALT,
    selectedId: "s",
    cursor: "s",
  },
  // Nudge it left, past the libero: the cue to the libero flares into a red overlap.
  {
    ms: 1300,
    positions: FAULT_POS,
    move: true,
    mode: "edit",
    title: TITLE_ALT,
    description: DESC_ALT,
    selectedId: "s",
    cursor: "s",
    grab: true,
  },
  {
    ms: 1900,
    positions: FAULT_POS,
    move: false,
    mode: "edit",
    title: TITLE_ALT,
    description: DESC_ALT,
    selectedId: "s",
    cursor: "s",
    rest: true,
  },
  // Pull it back legal: the edge settles to blue.
  {
    ms: 1200,
    positions: RECEIVE_POS,
    move: true,
    mode: "edit",
    title: TITLE_ALT,
    description: DESC_ALT,
    selectedId: "s",
    cursor: "s",
    grab: true,
  },
  {
    ms: 900,
    positions: RECEIVE_POS,
    move: false,
    mode: "edit",
    title: TITLE_ALT,
    description: DESC_ALT,
    selectedId: "s",
    cursor: "s",
  },
  // Click Done: the view settles on the finished lineup.
  {
    ms: 700,
    positions: RECEIVE_POS,
    move: false,
    mode: "edit",
    title: TITLE_ALT,
    description: DESC_ALT,
    selectedId: null,
    cursor: "done",
  },
  {
    ms: 650,
    positions: RECEIVE_POS,
    move: false,
    mode: "edit",
    title: TITLE_ALT,
    description: DESC_ALT,
    selectedId: null,
    cursor: "done",
    press: true,
  },
  {
    ms: 2200,
    positions: RECEIVE_POS,
    move: false,
    mode: "view",
    title: TITLE_ALT,
    description: DESC_ALT,
    selectedId: null,
    cursor: "park",
  },
  // Reset for the replay: the board eases back to the base lineup.
  {
    ms: 1600,
    positions: BASE_POS,
    move: true,
    mode: "view",
    title: TITLE_BASE,
    description: DESC_BASE,
    selectedId: null,
    cursor: "park",
  },
];

// The still the reduced-motion rest shows: the setter tapped on the overlap, the one frame that carries
// the whole feature — the red edge and the fault message — without any movement.
export const ROTATION_REST_INDEX = ROTATION_SCRIPT.findIndex((b) => b.rest);
