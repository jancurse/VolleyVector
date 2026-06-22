# VolleyVector architecture

VolleyVector is a single-page React 19 + TypeScript + Vite app for building, browsing, organising, and animating volleyball tactics and drills.
A coach lays out players and the ball on a court, writes markdown notes, and either keeps a single static arrangement or chains several into an animation.
Boards and notes persist to a Supabase backend behind invite-only accounts: accounts are organised into teams, every user also has a private personal space, and every access rule is enforced in the database by row-level security.

This document is the reference for how the client fits together.
It is organised by system rather than file by file: the data model, the court, the editor, motion, organisation, bundle exchange and print, the backend and access control, and the app shell.

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
  annotations?: Annotation[]; // drawn shapes; per step, no cross-step identity
  rotation?: StepRotation; // the step's official-position rotation, when set
};

type Board = {
  id: string;
  title: string;
  description: string; // markdown
  mode: CourtMode; // "positions" | "basic"
  markers: BoardMarker[]; // shared identities
  steps: BoardStep[]; // ordered, always >= 1
  tags: string[];
  createdBy: string | null; // the author account (attribution only), or null once their account is deleted
  capability: Capability; // the viewer's own access: "viewer" | "editor" | "owner"; derived, never stored
  currentRevisionId: string | null; // the revision this board's content matches, for conflict detection
  rotationStrict: boolean; // rotation enforcement: strict clamps illegal drags, loose only flags
  createdAt: number;
  updatedAt: number;
};
```

The client model carries only what a surface renders. A board's access list and revisions live in their own tables, mapped in `supabase/rows.ts`: `capability` is the viewer's effective grant (which gates the UI), and the share token is fetched on demand for a share link. See [Backend and access control](#backend-and-access-control).

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

### Rotations

A step may carry a rotation: the six players' official positions in the rotational order, shown on a small zone diagram beside the actual court. The legality lives in `boards/rotation.ts`, pure over the model like `operations.ts`.

- A `StepRotation` is either a **5-1 preset** (numbered by the setter's official position) or a **custom** assignment of markers to the six positions. Off is the absent field, so a step without one behaves exactly as before, and `insertStep` clones it alongside the positions.
- The six official positions (`RotationSlot` 1–6) are fixed canonical points (`OFFICIAL_SPOTS`: front row 4-3-2, back row 5-6-1). `presetAssignment` derives a preset's slot→marker map in 5-1 service order, swapping a libero to the back-row middle slot per rotation. It needs a matching 5-1 roster or returns null; a custom assignment resolves only once all six slots are filled.
- `rotationViolations` is the legality check: the seven pairwise overlap relations of FIVB Rule 7.4 (front/back on y, adjacent side-by-side on x), plus an assigned player outside the playing area and a libero on a front-row slot. Ties are legal. Only the six assigned players are constrained, never the ball, coach, or extras.
- `rotationStrict` (per board, default loose) picks enforcement. **Loose** flags violations: `violationFlags` maps them to a warning halo on each marker and a tie per broken pair. **Strict** is loose plus `clampToLegal`, which holds a dragged marker inside the region the others leave legal.
- `RotationPanel` (the editor) holds the selector, the enforcement toggle, the faults, and the rotation board; `RotationBoard` resolves the step's rotation onto `RotationDiagram` (`src/court/`), a 3×2 grid of the six official zones — a sketch of the rotation, not a miniature court — with a bench row for drag-to-zone assignment in custom mode. `BoardView` shows its own collapsible card of the same board and flags read-only, following the shown step during playback; while the rotation is active, tapping an assigned player on the court or the diagram cues its constraining neighbours (`constrainingNeighbours`) on both surfaces.

## The court and its coordinate system

The `court/` module is the rendering core. It owns the coordinate space, the SVG court, the markers, the arrows, the drawn annotations, and pointer interaction. It is shared unchanged by the editor, the read-only view, and the library thumbnails.

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
- Each role has a fixed style: a fill, a darker ring, label text colour, and a default label code (`S`, `OH`, `MB`, …). The fills are an OKLCH palette tuned to stay distinct under protan/deutan/tritan colour-blindness: a gold setter, a blue outside, a teal middle, a magenta opposite, and a violet libero, all in a narrow lightness band and clear of the danger red. The palette is deliberately theme-independent, so a marker's identity colour is the same in light and dark. A blue outside hitter is always blue.
- `CourtMode` selects which roles the authoring UI offers: `positions` exposes the volleyball roles, `basic` exposes a coach and generic numbered players for simpler diagrams. The mode only filters the palette and inspector. Every role renders identically.
- In basic mode a curated set of marker colours (`MARKER_COLORS`) lets a coach recolour markers, e.g. to separate two teams. It is also the annotation ink palette, reuses the same colour-blind-safe role hues with no red/green pair (the most-distinct two, blue and amber, lead it), and matches the player/coach defaults on `blue`/`slate` so a recoloured marker resets to its role colour. The retired `red`/`green` keys still load (remapped to magenta/teal) so old content keeps rendering.

### Markers and the ball

- A player marker is a coloured disc carrying a monospace label. The label text scales down as the label grows so it always fits.
- The ball is drawn separately: a custom volleyball in blue and yellow, rather than the usual white, so it stays legible against both the light and dark court.
- A selected marker shows a calm accent halo. During playback the marker's outer group glides between steps via Motion with a settle easing, while an inner group carries a one-time entrance animation, so animating a position never fights the entrance.

### Selection and dragging

- `useMarkerDrag` makes the court editable. It maps a pointer event back to normalized coordinates through the SVG's on-screen transform matrix, so dragging is exact regardless of how the court is sized or laid out on the page.
- The SVG captures the pointer on press, so a drag keeps tracking even when the cursor leaves the court, and every dragged position is clamped to the court plus its reach.
- Pressing the surface itself deselects. Fine positioning is also possible from the keyboard: with a marker selected, the arrow keys nudge it on the active step (a small step normally, a larger one with Shift).

### Annotations

Annotations are the shapes a coach draws on the court, stored as JSON on each step and rendered by the `Annotations` layer (a sibling of the derived `Arrows`) on every surface: editor, view, share view, and thumbnails.

- The kinds are a `line`, an `arrow` (optionally bent into a quadratic curve through a `via` point), a `rect`, an `ellipse`, a `polygon` (three or more implicitly closed vertices), a `free` freehand stroke, and a `text` label. Every shape carries a colour from the marker palette and a stroke width. The closed shapes (rect, ellipse, polygon) add a fill: `none`, a translucent tint, or a hand-drawn hachure. The stroked shapes can render solid or dashed.
- Unlike a marker, an annotation has no cross-step identity: it belongs to one step and never interpolates during playback. `copyAnnotationsToNextStep` carries a step's shapes forward when wanted.
- `useAnnotationDraw` owns the drawing gestures, reusing the same client→normalized mapping as marker dragging. Most kinds draw press-drag-release with magnetic snapping. The polygon is the one multi-click gesture: each click places a vertex, and the shape closes on the first or last vertex, a double-click, or Enter. A freehand stroke is simplified on commit and rendered as a constant-width path that smooths gentle turns while keeping deliberate corners sharp.
- The editor arms one tool per kind from the `AnnotationToolbar` (with hotkeys), and the `AnnotationInspector` edits the selected shape's style or sets the sticky style the next shape takes, showing the fill and dash controls only where they apply. The select tool moves a shape bodily or reshapes it through per-kind handles, with the handle logic in `boards/operations.ts`.
- Legacy stored shapes (the retired `area` kind, and closed shapes predating fills) normalize at read time in `boards/normalize.ts`, so old rows load as the current model with no data migration.

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

### Descriptions and tags

- `DescriptionEditor` is a markdown field with a Write/Preview toggle, reused for both a board's description and each step's instruction (in a compact variant).
- The tag input (`ui/Combobox`) manages a board's free-form tags as removable chips ending in a **ghost chip**: a dashed "+ Tag" chip that morphs into a chip-shaped input right where the new chip will land. A new tag commits on Enter, comma, or blur and duplicates are ignored; as the coach types it suggests matching tags from across the library, navigable by keyboard, so near-duplicates get reused rather than retyped.
- Tags are the only organising metadata on the board itself. A board's relation to notes lives in the notes (see [Organising boards](#organising-boards)), so the editor carries no note control.

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

Boards are organised two independent ways: free-form tags on the board itself, and notes — written documents that embed boards. Neither is a folder: a note references boards the way an Obsidian note links other notes, and tags cut across everything.

### Notes

A note plays two roles, kept deliberately separate. It is a **document** a coach reads, and a **node** in the organising tree. Its content lives in its blocks. Its place in the tree lives in `parentId`, and is edited only from the sidebar.

- A `Note` is a tree node carrying a document: an id, a title, an ordered `blocks` list, a nullable `parentId`, and an `order` among its siblings. Nesting is arbitrary depth.

```ts
type NoteBlock =
  | { id: string; kind: "markdown"; text: string }
  | { id: string; kind: "boards"; boardIds: string[] }; // the note's board links — the source of truth

type Note = {
  id: string;
  title: string;
  blocks: NoteBlock[]; // the document: prose and board-group blocks in order
  parentId: string | null;
  order: number;
  capability: Capability; // the viewer's own access; derived, never stored
  currentRevisionId: string | null; // the revision this note's content matches, for conflict detection
};
```

- **A `boards` block's ids are the links themselves.** The board carries no note reference: which boards a note shows is decided entirely by its own blocks, so any number of notes may reference the same board, a note may reference any number of boards, and a board referenced by no note simply lives in All Boards alone. There is no "Unfiled" state, because membership is not a property a board has. An id that no longer resolves in the space (a deleted or moved-away board) drops at render, and a board an earlier block already shows is not shown twice.
- Note operations (`notes/operations.ts`) create, rename, nest, reorder, and delete notes, and edit a note's blocks — which is also how board links are made and broken. `appendBoardToBlocks` adds a board to the end of a note's document (the last board group, or a fresh one); `notesReferencing` derives a board's backlinks. Deleting a note cascades to the whole subtree but never touches a board. Server-side the delete is a grace-archive rather than a hard cascade (see [Deletion and recovery](#deletion-and-recovery)). Nesting is guarded against cycles.
- A note page (`NoteView`) reads as a document: a subnote-link row, then the blocks in order — prose, and board groups as card grids resolving their ids. The editor (`NoteEditor`) commits a draft of the same blocks; a board group offers every board of the space through a title filter. The editor holds no tree position: nesting is the sidebar's job.
- The board view closes the loop with a quiet **Appears in** row (`notes/AppearsIn.tsx`): the notes referencing the open board as links, plus, for a curator, an add action that appends the board to a chosen note immediately. Creating a board from a note page links it into that note when its first commit succeeds.

### Tags and the browse surface

- The `library/` module is the browse home. A persistent `NoteSidebar` table of contents sits beside a content pane showing All Boards or one note's page. The sidebar lists All Boards, the note tree with disclosure controls, and a new-note action. Each row's quiet hover-revealed menu (`NoteRowMenu`) reorders the note among its siblings or re-nests it, so nesting lives here, not in the editor.
- The card grid splits in two. `CardGrid` is the plain grid of `LibraryCard`s, used by a note page's board groups. `BoardGrid` wraps it with one row of filter pills and serves the All Boards surface (`Library`) alone. Two kind pills lead the row (Positions / Sequences, mutually exclusive, pressed again to clear), then quick pills for the most-used tags with a searchable picker for the rest; every pressed pill narrows by intersection, and nothing pressed shows everything. Note pages render through `CardGrid`, so they carry no filters by construction.
- Each `LibraryCard` is a button showing a small static court thumbnail (a Sequence shows its first step), the board's kind, title, a count (markers for a Position, steps for a Sequence), and its tag chips. `toLibraryItems` folds the boards into these cards newest-first.
- Opening a card leaves the browse surface entirely for the full-width view. The browse selection is held above the surface, so closing a board returns to the same place.

## Bundle exchange and print

Content leaves and enters the app two ways: a portable JSON **bundle** that round-trips boards and notes, and a print surface that renders them as paper handouts. Both are pure client features and change no access rule.

### The bundle format

- `src/bundle/` owns the format: one versioned JSON object carrying notes and boards in full, rotations included, with no server-owned fields (creator, access list, revisions, tokens, timestamps). `types.ts` is the single source of truth, mirrored by the board-creator skill's `format.md`.
- Items reference each other through opaque local `ref` strings (`parentRef`, `boardRefs`) that resolve within the bundle only. Import mints fresh ids and slugs; export uses the real ids as refs.
- `FORMAT_VERSION` guards compatibility: an older bundle is normalized on parse with a "skill may be out of date" notice, and a newer one is rejected as the app being out of date. Version 2 named the notes `topics` and filed boards through a `topicRef`; parsing still reads both, folding a `topicRef` into a trailing board link on its note.
- `parseBundle` is strict on structure and lenient on content. Malformed JSON, unknown refs, and missing required fields become readable errors; an out-of-range coordinate clamps to the court, a step missing a marker's position benches that marker, and an invalid annotation is dropped, each with a notice rather than a failure.

### Export and import

- Export builds a bundle at three levels: one board (the board's overflow menu and the share view's copy button), one note with its whole subtree and every board those notes reference (the note page menu), and the entire active space (the library page-bar menu). Each offers **Copy JSON** and **Download JSON**, and viewing rights suffice, so any user can take everything they can see.
- **Import JSON…** in the library menu (shown only with create rights) parses pasted or file-picked JSON as it arrives and shows either the validation errors or a preview: the note tree plus each board as a static court thumbnail, with any notices. Confirming creates-only into the active space through the normal store writes, notes parents-first then boards; nothing is written before then, and a failed write surfaces in the dialog.
- **Replace from JSON…** in the board menu overwrites one board's content from a single-board bundle while keeping its identity (id, creator, access list), so iterating on a generated board needs no delete-and-reimport.
- The **board-creator** project skill (`.claude/skills/board-creator/`) authors bundles from prose or documents and validates them with a standalone script; a test feeds its example bundles through the real parser so the two cannot drift. In development a `#/preview` route renders draft bundles live (see the developer guide).

### Print handouts

- `src/print/` renders a board or note as a chrome-free paper document at the `…/print` routes, reached from the board menu and the note export menu; the browser does the printing or PDF saving.
- `PrintView` forces the light theme and titles the document after its content. `BoardPrint` lays out the courts with their derived arrows and instructions, and `NotePrint` expands the note document's board groups through it, covering the boards the note itself references (unlike the note JSON export, which carries the subtree).

## Backend and access control

Boards and notes live in Supabase, not the browser. The access boundary is row-level security in the database: every read and write rule holds even if the client is bypassed, so the client is never trusted. `src/supabase/` holds the one browser client (carrying only the public URL and publishable key) and the row↔model mappers.

### Tables, principals, and the access list

- The schema's core tables are `profiles` (one per account, with a display name and the global-admin flag), `teams`, `memberships` (`(user, team, role)`, role `coach` or `player`), `topics` (the notes — the table keeps its legacy name, as do the RPCs around it), `boards`, and `invites` (single-use invite links). Markers and steps are stored as JSON on a board, and a note's blocks (including its board links) as JSON on its row.
- A profile's `email` is personal data: it is case-insensitively unique (one address maps to at most one account) and never selectable by an ordinary client. RLS scopes profile rows to teammates so a display name resolves, but the `email` column is granted only to the admin path — the `admin_list_profiles` RPC, guarded by `is_admin()` — so a non-admin client never receives another user's email from any query.
- A board or note carries a `created_by` label (attribution only, nullable, never load-bearing) and an **access list**: `board_access` and `topic_access` rows, each one grant of `(principal, capability)`. A **principal** is a user or a team (exactly one column set); a **capability** is `viewer`, `editor`, or `owner`. Content appears in a space's library when that space's principal is on its list, so one board can live in several teams and a personal space at once, and "scope" is derived from the grants rather than stored.
- A **team grant** maps the team's roles, capped by the grant's capability: a coach gets the grant's capability, any member at least viewer. So a team `owner` grant is an ordinary team-library board (coaches manage, players view); a team `viewer` grant is read-only for the whole team. Sharing a board into a team and moving it there are the same operation: adding a team grant at the chosen capability.
- At most one team is flagged `is_showcase` (enforced by a partial unique index): the **Inspiration** showcase, an example library every authenticated user may read and copy from. A grant to the showcase team reads as viewer for everyone; writes are unchanged, so only its coaches and admins author it.
- A board also carries an unguessable `share_token` minted server-side. Boards, notes, teams, and profiles all carry soft-delete state (`deleted_at`/`deleted_by`); every read query filters `deleted_at is null`, so a deleted row is hidden everywhere but admin recovery. See [Deletion and recovery](#deletion-and-recovery).
- `board_capability(board)` and `topic_capability(topic)` are the `security definer` helpers that return the caller's highest grant (admin is owner everywhere). Policies read through them: select with any capability, update with editor or owner, and change the access list only with owner — except that anyone may always remove their own grant (leave). `capability_rank` orders the three levels so a policy can compare.

### Who may do what

| Action                                | Player | Coach        | Admin           |
|---------------------------------------|--------|--------------|-----------------|
| View content granted to their team    | ✓      | ✓            | ✓ (every team)  |
| View the Inspiration showcase library | ✓      | ✓            | ✓               |
| Edit content a team holds for editing | —      | ✓ (own team) | ✓ (every team)  |
| Co-edit a board granted to them       | ✓      | ✓            | ✓               |
| Their own personal space              | full   | full         | full + god-mode |
| Invite a member                       | —      | ✓ (own team) | ✓ (any team)    |
| Create a team                         | —      | —            | ✓               |
| Delete their own account              | ✓      | ✓            | ✓               |
| Archive or delete a team              | —      | —            | ✓               |
| Restore deleted content or an account | —      | —            | ✓               |

- RLS helper functions (`is_admin`, `is_team_member`, `is_team_coach`, `is_showcase_team`, plus the capability functions) run `security definer` so a policy can resolve a grant without recursing. Only an owner (a board's creator by default, or anyone granted owner) changes its access list. A `boards` guard trigger keeps `created_by` immutable except to an admin, and adding a team grant requires coaching that team, so a board cannot be pushed into an arbitrary team's library.
- An admin has full read/write across all teams and all personal content. This god-mode is a deliberate privacy trade-off for a small trusted group, called out in the README.

### Deletion and recovery

Removal is a grace-archive, never an immediate hard delete: a removed item is hidden from every normal view, kept three months for admin recovery, then purged. Four removals differ:

- **Removal is detaching a grant, and archiving is reference-counted.** Deleting a board removes the caller's own grant rather than destroying the board; an `after delete` trigger on the access list grace-archives the row (`deleted_at`/`deleted_by`) only once its last grant is gone, so a board others still hold lives on. `removeNote` calls `soft_delete_topic`, which archives the whole subtree (boards are untouched — a note's links live in its own blocks). Every space query filters `deleted_at is null`.
- **Removing a player** drops only their membership; their content is untouched (RLS already allowed it).
- **A team** has two admin-only states: archive (`archived_at`, a reversible hidden state dropped from the space switcher) and delete (the `delete_team` RPC sets `deleted_at` and starts the purge clock). Delete flags only the team; purging it cascades its grants away, and the reference-count trigger then archives whatever that orphaned.
- **An account** deletes through the `delete-account` Edge Function: it bans the auth user and soft-deletes the profile, removing the user as a principal. Content only they held grace-archives; content a team still holds lives on. An admin restores within the window via `restore-account` (un-bans and clears the flag).
- **Purging** runs `purge_expired` (the `purge-expired` Edge Function) on a server-side schedule, hard-deleting boards, notes, and teams past three months. It is granted to `service_role` only, never reachable from a client. The admin panel (`src/admin/`) reads every recovery list through god-mode and drives the restores.

### Sharing and the share link

- Sharing is editing the access list: an owner adds a grant for a user (co-editing one board) or a team (placing it in that team's library), at viewer, editor, or owner. Multiple grants are how a coach of several teams keeps one board across them, and how teammates co-edit a single board instead of each holding a copy. `src/sharing/` holds the board and note access managers, the copy actions (a deliberate fork into a separate board), and the read-only `ShareView`. Copy stays for forking; live grants replace copy-back-and-forth for collaboration. A note is shared the same way and carries its own per-note capability: its access manager grants the whole subtree at once, writing one grant per node so reads stay non-recursive.
- Every board has a `share_token`. The `board_by_token` function (`security definer`, granted to anonymous) resolves one board from an exact token, but only a genuinely shared one (a team grant, or a grant to a user other than its creator), so a private board never leaks and the collection cannot be enumerated. The read-only viewer is reached by the `#/share/<token>` hash route.
- The access manager's add-a-person picker is **relationship-scoped**: it offers only the sharer's teammates (members of the teams the sharer belongs to), grouped by team and searchable, and never loads the global accounts table. People are named by display name, never email.
- An owner shares **outside their teams** two ways, neither of which enumerates accounts or returns an email. A **grant link** is a single-use, expiring, revocable token (`access_links`, minted server-side, mirroring invites) carrying the board/note and a capability; the first signed-in user to redeem it at `#/grant/<token>` gets the grant bound to their own account, written by the `redeem_access_link` security-definer RPC (a note link grants the whole subtree). An **exact-email grant** (`grant_board_by_email`/`grant_topic_by_email`) resolves and grants in one server step: the owner check runs before and independent of the email lookup, and the RPC returns nothing whether or not an account matched, so a miss is indistinguishable from a hit (no account-existence oracle).

### Versioning and history

Every commit (the editor's Done) is a revision, so boards and notes carry a linear edit history with conflict detection. There is no branching or merging: co-editing means taking turns, made safe by the conflict check.

- `board_revisions` and `topic_revisions` hold one append-only content snapshot per commit, with its author, time, and the revision it was based on; the board/note row points at its `current_revision_id`.
- Committing goes through the `commit_board`/`commit_topic` RPCs, a compare-and-swap: the editor passes the revision it started from, and the write only lands while that is still current. A stale base returns a conflict the editor resolves (overwrite, save a copy, or discard) rather than silently clobbering a co-editor.
- History reads as a revision list on the view with a change summary and a read-only preview; restoring an old revision commits its content as a new revision rather than rewinding, keeping history append-only.

### Auth, invites, and keep-alive

- Auth is invite-only email + password (`src/auth/`). An unauthenticated visitor reaches only the login screen, a valid share link, and a valid invite link. There is no open sign-up: an account is only ever created server-side, by the `invite` or `redeem-invite` Edge Function.
- Inviting by email creates an account and emails it, which needs a privileged server key, so it runs in a Supabase Edge Function (`supabase/functions/invite/`) that authorizes the caller from their own login before acting. Team creation and re-roling are plain client writes RLS allows. The email path is currently hidden in the UI (the built-in sender is rate-limited), so links are the only invite surface for now; the `invite` function stays in place for when it is restored.
- Inviting by link is the second invite path, for sharing through any channel (WhatsApp, etc.). A coach mints a single-use link (a row in `invites`, with the team, role, a 7-day expiry, and a server-minted token), shown in the team manager. The recipient opens `#/invite/<token>`: `invite_preview` (`security definer`, granted to anonymous) reveals the team and role only while the link is still valid, then they either join in one click if already signed in or set up an account with their own email and password. Redeeming runs in `supabase/functions/redeem-invite/`, which holds the secret key: it claims the link atomically (`update ... where used_at is null`, so two people racing one link see one winner), creates the account if the recipient is new, and adds the membership. `src/invites/` holds the client helpers, the `#/invite/<token>` route, and the `InviteAccept` screen.
- A scheduled GitHub Action (`.github/workflows/keep-alive.yml`) pings the database twice a week so the free-tier project never pauses.

## State, persistence, and the app shell

### Stores and persistence

- `useBoards` and `useNotes` hold the active space's board list and note tree in React state and expose the mutations the UI calls. Both load from Supabase when the active space changes, by the space's principal on the access list (a team's grants by team, the personal space's by the user), and attach the viewer's `capability` to each item. They write content edits through the commit RPC (which records a revision and rejects a stale base) and access-list edits through `board_access`/`topic_access`. Edits apply optimistically; a failed write surfaces an error and refetches to reconcile.
- The active space comes from `workspace/useWorkspace.ts`, which loads the user's teams, role per team, and admin flag, and tracks which space is on screen. The space switcher moves between the personal space and each team, and everyone also sees the read-only Inspiration showcase as its own icon-badged row. A showcase membership (a curator) is carried on `showcase.role` rather than in the team list, so the showcase stays one row whether or not the user is on its roster. An admin also reaches every remaining team behind a collapsed "Other teams" disclosure, so the switcher stays short as teams grow. Creating a team adds no membership: the new team lands in the admin's other teams. The team page lets an admin join any reachable team (including the showcase) with a chosen role and leave again, since their access never depended on membership.
- The stores keep the two models honest. A note's board groups carry their own explicit order, so curating a note never touches a board, and structural note moves (reordering siblings, nesting from the sidebar) only touch the note tree — neither churns the library's newest-first order. The first team's library is seeded once, server-side, by the setup seed.

### Navigation and the app shell

- `App` is the top-level owner of navigation and ties the stores together. A share link or invite link wins over everything, since both open with no account; otherwise an unauthenticated visitor sees the login gate. After sign-in two one-time gates can precede the app: an invite-email recipient sets a password (their account is created without one), and a first-time user sets a display name. Past the gates it chooses between three surfaces by precedence: a draft in the editor wins, otherwise an open board shows its view, otherwise the browse surface.
- Creating a board makes a single-step Position in the active space and opens it in the editor; created from a note page, its first commit also appends it to that note's document. Committing returns to the board's view. Deleting a board, or a note (which grace-archives the subtree and leaves boards alone), is confirmed first and stays recoverable by an admin within the window.
- The top bar carries the breadcrumb and the single account control: a menu for the display name and sign-in email, an **Invite** action (shown to an admin, a coach, or any account with invite quota), the theme toggle, and sign-out. **Delete account** lives on the Account settings page, behind its confirm dialog. In drawer mode it gains a leading toggle that opens the navigation overlay. The brand, the space switcher, and the **Admin** entry (admins only, for teams, accounts, and content recovery) live in the sidebar, or its icon rail, not the header.
- Team management is reached two ways so it stays available at every sidebar width: a gear on the active team's row in the full sidebar, and a **Manage team…** item on the team library's page-bar overflow menu (the entry the rail and drawer rely on, since they hide the gear). Both show only for a coach of that team or an admin, and route to the team page, where roles are managed and invite links minted.

### Theme and typography

- `useTheme` drives a light or dark theme, defaulting to the system preference and persisting the choice. It sets a `data-theme` attribute on the document, and the whole interface is themed through CSS variables keyed off it.
- The type system pairs a display family for headings, a humanist sans for the UI, and a monospace for marker labels, and motion is kept restrained throughout with a single shared settle easing.

### UI components and styling

- The app chrome is built on Base UI primitives styled with Tailwind v4. `src/ui/` holds one thin wrapper per control (`Button`, `Input`, `Select`, `Combobox`, `Menu`, `Tabs`, `AlertDialog`, `Toolbar`, and the rest), and every surface renders through them, so each control has a single definition. Base UI gives the overlays correct keyboard, focus, dismissal, and screen-reader behaviour by construction. The shared class strings live in `src/ui/styles.ts`, and no surface styles a control ad hoc. Every floating overlay (menus, listboxes, popovers, tooltips, and the modals) rides one elevated `overlay` surface token, distinct from the court floor's `court-surface`, so a popup reads as the lightest layer in light mode and clearly lifted in dark.
- Icons come from Lucide (`lucide-react`), since Base UI ships none. Every UI glyph is a Lucide component (`<Sun />`, `<ChevronRight />`, `<Play />`), never a hand-drawn `<svg>`, so the icon language stays consistent and new glyphs cost an import rather than a path. Two things stay hand-drawn: the domain art in `src/court/` (the volleyball, the woven net, the court lines), which is illustration rather than iconography, and the brand mark.
- The brand mark (the board cropped to a rounded court with the ball breaking the corner) is drawn from one geometry source, `src/shell/brandMarkGeometry.ts`: `BrandMark` renders it live (with `BrandLockup` for the mark-plus-wordmark lockup), and `scripts/generate-brand-assets.ts` (`npm run generate:brand`) generates the static assets from the same source, so no surface can drift. Every in-product surface renders these rather than inlining the glyph. In the product the mark is monochrome and theme-aware: the court draws in `currentColor` and the amber ball is the one constant accent. The favicon (`public/favicon.svg`, linked from `index.html`) is the transparent mark, its court swapping with the browser's light or dark chrome. See the [brand guide](brand.md) for the expressions, colours, lockup, and usage.
- Design tokens live in a Tailwind `@theme` layer in `src/index.css`: the fonts, the radius, shadow, and type scales, and the light and dark colours. The theme-swapping colours map onto runtime CSS variables, so a utility like `bg-panel` follows the theme switch with no `dark:` variants.
- The court keeps its own scoped raw CSS in `src/court/court.css`, the only non-Tailwind styling left.

## Deployment and operations

The front end ships as a static bundle on Cloudflare Pages. There is no application server, so every access rule stays in the database under row-level security, exactly as in development.

- **Host and URL.** The Vite build deploys to the Cloudflare Pages project `volleyvector`, served at the custom domain `volleyvector.app`. The old `volleycoach.pages.dev` subdomain 301-redirects to it (a one-off redirect build on the retained `volleycoach` project), so old links keep working. A `public/_redirects` rule (`/*  /index.html  200`) ships in the bundle so deep links, the share and invite routes, resolve to `index.html` instead of 404ing on a static host.
- **Pipeline.** `.github/workflows/deploy.yml` publishes the build with Wrangler, but only after CI passes on `main`. It runs on `workflow_run` (and manual `workflow_dispatch`) and checks out the exact commit CI verified, so only green `main` commits reach production. There are no automatic preview deploys.
- **Database migrations.** Migrations reach production only by a deliberate, CI-gated push on merge, never during feature work. `.github/workflows/migrate-prod.yml` runs `supabase db push` after CI passes on `main` (the same green-`main` gating as the deploy), authenticated by the `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` repository secrets. There is no manual approval button: a PR that touches `supabase/migrations/` is flagged by `.github/workflows/migration-guard.yml` with a label and a comment, and the deliberate act is merging after seeing that warning. The native click-to-approve gate (GitHub Environments required reviewers) is unavailable on a private free repo.
- **Edge Functions.** Functions reach production the same way, by a CI-gated deploy on merge. `.github/workflows/deploy-functions.yml` runs `supabase functions deploy` (with `--no-verify-jwt`, matching the manual deploys it replaces) after CI passes on `main`, authenticated by the `SUPABASE_ACCESS_TOKEN` secret alone (a function deploy needs no database password). Every green-`main` run deploys all functions, like the migration push always runs: re-uploading an unchanged function is an idempotent no-op, and skipping by per-commit diff would miss a change made in an earlier commit of a rebase-merged PR. The same `migration-guard.yml` flags a PR that changes them. Function secrets stay a manual, user-only step, and the local CLI never deploys to production.
- **Local development and verification.** The only non-production environment is a local, Docker-based Supabase stack built from the migrations and a local-only seed (`supabase/config.toml`, `supabase/seed.sql`). Database changes are developed and verified there before they merge, and the RLS regression test (`supabase/tests/rls_policies_test.sql`) runs against it both locally (`npm run test:rls`) and as a CI job on every PR, so a policy regression fails a PR instead of reaching production. The developer guide covers the dev modes.
- **Production configuration.** The build reads the Supabase URL and publishable key from GitHub Actions repository variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`), and the Cloudflare API token and account ID from secrets. Both Supabase values are public by design, since RLS is the guard, and keeping them as CI config rather than committed files lets a separate production project be introduced without a code change. The production URL is registered in Supabase's auth Site URL and redirect allow-list, so login, share, and invite links resolve back to the app.
