# VolleyCoach architecture

VolleyCoach is a single-page React 19 + TypeScript + Vite app for building, browsing, organising, and animating volleyball tactics and drills.
It runs entirely in the browser: a coach lays out players and the ball on a court, writes markdown notes, and either keeps a single static arrangement or chains several into an animation.
All state lives in the browser's `localStorage`. There is no backend, no accounts, and no network.

This document is the reference for how the client fits together.
It is organised by system rather than file by file: the data model, the court, the editor, motion, organisation, and the app shell.

## Spine decisions

A few choices are load-bearing. Most of the architecture follows from them, and they are expensive to change, so they are fixed rather than re-decided per feature.

- **Normalized 0–1 coordinates, never pixels.** Every marker position is a fraction of the playing area, so a diagram is resolution-independent and stays crisp at any size. Only `court/geometry.ts` knows about SVG units.
- **Stable marker identity across all steps.** A marker's identity (its role, label, and colour) is stored once for the whole board. Only its position varies from step to step. This single decision makes animation interpolate each marker by identity and makes movement arrows fall out of the position deltas. Neither needs separate data.
- **One `Court` component for both modes.** A static diagram and one animated step are the same component with different inputs, so there is no second renderer to keep in sync.
- **SVG, not canvas.** The court is a rectangle with roughly a dozen markers that must stay sharp on a phone and animate smoothly, which SVG does directly as React components.
- **One `Board` type.** Static and animated content are not separate types. A board is animated exactly when it has more than one step. The kind is derived, never stored.

## The data model

The whole app is built on one type. A `Board` is a single court diagram: an ordered, non-empty list of steps over a shared set of marker identities.

```ts
type BoardMarker = Omit<Marker, "position">; // id, role, label?, color?

type BoardStep = {
  id: string;
  instruction: string; // markdown, shown during playback
  positions: Record<string, NormalizedPoint>; // by marker id
};

type Board = {
  id: string;
  title: string;
  description: string; // markdown
  mode: CourtMode; // "positions" | "basic"
  markers: BoardMarker[]; // shared identities
  steps: BoardStep[]; // ordered, always >= 1
  tags: string[];
  topicId: string | null; // home topic, or Unfiled
  topicOrder: number; // manual order within that topic
  createdAt: number;
  updatedAt: number;
};
```

### Positions and Sequences

- The number of steps decides everything about how a board looks and behaves. `isSequence(board)` is simply `board.steps.length > 1`.
    - A **Position** has exactly one step. It renders and edits as a static court: no transport, just the diagram and its description.
    - A **Sequence** has two or more steps. It renders and edits as an animated court with transport controls, a step scrubber, and a per-step instruction.
- A board is never empty: it always carries at least one step, so there is no "blank board" state to handle.

### Marker identity and per-step positions

- A board's `markers` array holds each marker's identity once: its `id`, `role`, optional `label` override, and optional `color` override.
- Each step's `positions` map gives every marker a `NormalizedPoint` for that step, keyed by marker id.
- A full `Marker` (identity plus a concrete position) only exists transiently. `stepMarkers(board, index)` joins the shared identities with one step's positions to produce the array the `Court` renders.

### Pure operations

`boards/operations.ts` holds every board transform as a pure function. Nothing here touches storage or the DOM, which keeps the model easy to test and reason about. The operations split cleanly along the identity-vs-position line:

- **Identity edits span every step.** `addMarker` gives a marker a new identity and a benched position on every step. `setMarker` patches role, label, or colour across the whole board. `removeMarker` drops the identity and its position from all steps.
- **Position edits touch one step.** `setStepPosition` moves a single marker on a single step, leaving the others untouched.
- **Step edits keep the board valid.** `insertStep` adds a step after a given index, cloning that step's positions so only what changes needs dragging. `moveStep` reorders. `removeStep` deletes a step but always keeps at least one, so a board never drops below a Position. `setStepInstruction` edits a step's note.
- **Creation.** `createBoard` makes a fresh single-step Position. `makeMarker` labels a new marker, numbering it to keep it distinct from others of its role (e.g. `OH1`, `OH2`), and places it on a "bench" row just below the end line, ready to be dragged onto the court.

## The court and its coordinate system

The `court/` module is the rendering core. It owns the coordinate space, the SVG court, the markers, the arrows, and pointer dragging. It is shared unchanged by the editor, the read-only view, and the library thumbnails.

### Normalized coordinates

- Positions are stored as `{ x, y }` fractions in `[0, 1]`: `x` runs sideline to sideline, `y` runs from the net to the end line.
- `geometry.ts` is the only place that maps normalized space to SVG. It defines a square playing area inside a wider square `viewBox`, with a free-zone margin so the court has room to breathe, and the attack line one third of the way down the half-court.
- A marker may sit a little past the playing area, far enough for the ball to hang over the net or a deep serve to start behind the end line. `clampToCourt` holds every position within that reach so a marker never clips the `viewBox` edge.
- `toSvg`/`toSvgPoint` and their inverses convert between the two spaces. Everything above this module works only in normalized coordinates.

### The `Court` component

- `Court` renders one diagram: the playing surface, the front-zone shading, the boundary, the attack line, a woven net, then any arrows, then the markers.
- The same component is static or editable depending on its props. Passing both `onSelect` and `onMove` turns it into an editable surface (click to select, drag to move). Without them it is a read-only diagram.
- `animated` switches markers between gliding to their positions (playback) and snapping to them exactly (editing and static views). `arrows` overlays a set of derived movement arrows beneath the markers.

### Roles, labels, and colours

- `roles.ts` defines the marker vocabulary. A `MarkerRole` is one of the volleyball positions (`setter`, `outside`, `middle`, `opposite`, `libero`, `ball`) or the generic `coach`/`player`.
- Each role has a fixed style: a fill, a darker ring, label text colour, and a default label code (`S`, `OH`, `MB`, …). The palette is deliberately theme-independent, so a marker's identity colour is the same in light and dark. A blue outside hitter is always blue.
- `CourtMode` selects which roles the authoring UI offers: `positions` exposes the volleyball roles, `basic` exposes a coach and generic numbered players for simpler diagrams. The mode only filters the palette and inspector. Every role renders identically.
- In basic mode a curated set of marker colours (`MARKER_COLORS`) lets a coach recolour markers, e.g. to separate two teams, reusing the same fixed palette so the visual language stays consistent.

### Markers and the ball

- A player marker is a coloured disc carrying a monospace label. The label text scales down as the label grows so it always fits.
- The ball is drawn separately: a custom volleyball in blue and yellow, rather than the usual white, so it stays legible against both the light and dark court.
- A selected marker shows a calm accent halo. During playback the marker's outer group glides between steps via Motion with a settle easing, while an inner group carries a one-time entrance animation, so animating a position never fights the entrance.

### Selection and dragging

- `useMarkerDrag` makes the court editable. It maps a pointer event back to normalized coordinates through the SVG's on-screen transform matrix, so dragging is exact regardless of how the court is sized or laid out on the page.
- The SVG captures the pointer on press, so a drag keeps tracking even when the cursor leaves the court, and every dragged position is clamped to the court plus its reach.
- Pressing the surface itself deselects. Fine positioning is also possible from the keyboard: with a marker selected, the arrow keys nudge it on the active step (a small step normally, a larger one with Shift).

## Authoring a board

The `editor/` module is where boards are read and written. It follows one flow throughout: open into a read-only view, then edit a draft and commit it.

### The view-first, edit-draft flow

- `BoardView` is the read-only surface a viewer sees. A Position shows the static court and the rendered description. A Sequence shows the animated court, transport controls, a clickable step scrubber, and the current step's instruction crossfading in below the description.
- Editing happens on a working draft. `BoardEditor` edits a local copy of the board. **Done** commits the draft and **Cancel** discards it, so nothing reaches storage mid-edit.
- Both surfaces are full-width. The browse sidebar belongs only to the library.

### Editing markers and steps

- Markers are added from the `MarkerPalette`, a row of role buttons that double as a legend. A new marker lands on the bench, ready to drag onto the court.
- The `MarkerInspector` edits the selected marker's identity: its role, a short label override, a colour (in basic mode, for non-ball markers), and a remove action. Because these are identity edits, each one applies across every step.
- A single-step board shows an **Add step** affordance that promotes it to a Sequence in place, cloning the current positions. Once a board has two or more steps the `StepStrip` appears: it selects the active step, inserts a step after the current one, reorders the active step, and removes a step (never below one). The active step is tracked by its id, so inserting, reordering, or removing never loses the coach's place.
- Position edits (dragging or nudging a marker) touch only the active step, while the identity edits above span the whole board. This is the editor expression of the model's identity-vs-position split.

### Descriptions, tags, and topic

- `DescriptionEditor` is a markdown field with a Write/Preview toggle, reused for both a board's description and each step's instruction (in a compact variant).
- `TagEditor` manages a board's free-form tags as removable chips, committing a new tag on Enter, comma, or blur and ignoring duplicates. As the coach types it suggests matching tags from across the library, navigable by keyboard, so near-duplicates get reused rather than retyped.
- A `TopicPicker` in the editor files the board under one home topic (or leaves it Unfiled), alongside the tag editor.

## Motion and playback

Motion is part of the product, so animation is built into the model rather than bolted on. A Sequence animates by interpolating each marker by identity, and the arrows that show movement are derived, never authored.

### Derived movement arrows

- `stepMoves(board, index)` diffs two consecutive steps by marker identity and returns each marker's `from`/`to`, dropping markers that barely move so a tiny adjustment draws no arrow.
- `arrowsForStep` colours each move to its marker, a player in its own colour and the ball in a theme-adaptive neutral, producing the `Arrow` list the court overlays.
- `Arrows` insets each line so it clears the source and target discs and ends in an arrowhead. A move too short to clear both discs is skipped, so near-overlapping moves never render a degenerate arrow.
- Arrows are recomputed on demand and never stored. A coach shapes them only by moving markers between steps. They show on the editor's active step and, during playback, preview the upcoming move while paused.

### The playback clock

- `useBoardPlayback` owns which step is shown and whether playback is running, and exposes step, play/pause/toggle, jump-to-step, and next/previous.
- While playing it advances on a clock: each advance allows time for the glide plus a dwell to read the new step, and playback stops on the last step rather than looping. Starting from the end replays from the first step.
- Reduced-motion preferences are honoured, so the same controls still step through a Sequence without animation when the user asks for less motion.

## Organising boards

Boards are organised two independent ways: a single home topic that places a board in a curated hierarchy, and free-form tags that cut across it.

### Topics

- A `Topic` is a tree node: an id, a title, an optional markdown `body`, a nullable `parentId`, and an `order` among its siblings. Nesting is arbitrary depth.
- A board has **at most one** home topic. Its `topicId` is the single source of truth for membership and its `topicOrder` is the manual order within that topic. A board with no topic is **Unfiled**. A topic never lists its own boards, so membership is never duplicated.
- Topic operations (`topics/operations.ts`) create, rename, delete, nest, and reorder topics. Deleting a topic cascades to its whole subtree but never deletes boards: the app returns any boards under the removed topics to Unfiled. Nesting is guarded against cycles, so a topic can never become its own ancestor.
- A topic page shows the topic's markdown explanation above the boards filed **directly** in it (not its descendants'), in their manual order, and offers per-board reorder and a remove that returns a board to Unfiled.
- One `TopicPicker`, a depth-indented dropdown over the flattened tree, serves both filing a board (with a None → Unfiled option) and nesting a topic (with a None → top-level option, excluding the topic and its descendants to bar cycles).

### Tags and the browse surface

- The `library/` module is the browse home. A persistent `TopicSidebar` table of contents sits beside a content pane that shows All Boards, Unfiled, or one topic's page. The sidebar holds All Boards at the top, the topic tree with disclosure controls and hover-revealed reorder, and a new-topic action.
- `BoardGrid` carries the filtering and the card grid for all three surfaces. A type control filters All / Positions / Sequences, and selecting tags narrows by intersection: a board must carry every selected tag. Distinct empty states tell "nothing matches these filters" apart from "nothing here yet".
- Each `LibraryCard` is a button showing a small static court thumbnail (a Sequence shows its first step), the board's kind, title, a count (markers for a Position, steps for a Sequence), and its tag chips. `toLibraryItems` folds the boards into these cards newest-first.
- Opening a card leaves the browse surface entirely for the full-width view. The browse selection is held above the surface, so closing a board returns to the same place.

## State, persistence, and the app shell

### Stores and persistence

- `useBoards` and `useTopics` hold the board list and the topic tree in React state and expose the mutations the UI calls. Both load their data on first mount and persist it back to `localStorage` after edits settle, batching a burst of edits into one write.
- Each store seeds itself from samples when nothing is stored yet, so the app opens with a Position, a Sequence, and a small starter topic tree to explore rather than an empty screen.
- The stores keep the two concerns honest. Filing or editing a board refreshes its `updatedAt`, while purely structural reordering within a topic deliberately does not, so curation never churns the newest-first order of the library.

### Navigation and the app shell

- `App` is the top-level owner of navigation and ties the two stores together. It chooses between three surfaces by precedence: a draft in the editor wins, otherwise an open board shows its view, otherwise the browse surface.
- Creating a board makes a single-step Position and opens it in the editor. Committing files the board into its chosen topic and returns to its view. Deleting a board (and deleting a topic, which cascades and unfiles its boards) is confirmed first.
- The header carries the brand, the theme toggle, and, only in a development build, a debug menu for clearing stored boards, topics, or all local state.

### Theme and typography

- `useTheme` drives a light or dark theme, defaulting to the system preference and persisting the choice. It sets a `data-theme` attribute on the document, and the whole interface is themed through CSS variables keyed off it.
- The type system pairs a display family for headings, a humanist sans for the UI, and a monospace for marker labels, and motion is kept restrained throughout with a single shared settle easing.

### UI components and styling

- The app chrome is built on Base UI primitives styled with Tailwind v4. `src/ui/` holds one thin wrapper per control (`Button`, `Input`, `Select`, `Combobox`, `Menu`, `Tabs`, `AlertDialog`, `Toolbar`, and the rest), and every surface renders through them, so each control has a single definition. Base UI gives the overlays correct keyboard, focus, dismissal, and screen-reader behaviour by construction. The shared class strings live in `src/ui/styles.ts`, and no surface styles a control ad hoc.
- Design tokens live in a Tailwind `@theme` layer in `src/index.css`: the fonts, the radius, shadow, and type scales, and the light and dark colours. The theme-swapping colours map onto runtime CSS variables, so a utility like `bg-panel` follows the theme switch with no `dark:` variants.
- The court keeps its own scoped raw CSS in `src/court/court.css`, the only non-Tailwind styling left.
