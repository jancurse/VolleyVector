# VolleyCoach architecture

VolleyCoach is a single-page React 19 + TypeScript + Vite app for building, browsing, organising, and animating volleyball tactics and drills.
A coach lays out players and the ball on a court, writes markdown notes, and either keeps a single static arrangement or chains several into an animation.
Boards and topics persist to a Supabase backend behind invite-only accounts: accounts are organised into teams, every user also has a private personal space, and every access rule is enforced in the database by row-level security.

This document is the reference for how the client fits together.
It is organised by system rather than file by file: the data model, the court, the editor, motion, organisation, the backend and access control, and the app shell.

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
  owner: string | null; // the author account, or null once their account is deleted; set server-side
  authorLocked: boolean; // a team board only its author and admins may edit
  shared: boolean; // a personal board made visible to its team
  teamId: string | null; // a team board's team, or a shared personal board's target team
  createdAt: number;
  updatedAt: number;
};
```

The client model carries only what a surface renders. The placement and access columns a board also has server-side (its `scope`, its team, the share token) are mapped in `supabase/rows.ts`: `scope` follows the active space, and the token is fetched on demand for a share link. See [Backend and access control](#backend-and-access-control).

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

A topic plays two roles, kept deliberately separate. It is a **document** a coach reads, and a **node** in the organising tree. Its content lives in its blocks. Its place in the tree lives in `parentId`, and is edited only from the sidebar.

- A `Topic` is a tree node carrying a document: an id, a title, an ordered `blocks` list, a nullable `parentId`, and an `order` among its siblings. Nesting is arbitrary depth.

```ts
type TopicBlock =
  | { id: string; kind: "markdown"; text: string }
  | { id: string; kind: "boards"; boardIds: string[] }; // placement hints, not membership

type Topic = {
  id: string;
  title: string;
  blocks: TopicBlock[]; // the document: prose and board-group blocks in order
  parentId: string | null;
  order: number;
};
```

- A board has **at most one** home topic, and its `topicId` is the single source of truth for membership. A board with no topic is **Unfiled**. A `boards` block's ids are only placement hints, intersected with the topic's real members where they render, so a stale id drops and a board never shows twice. Members carry no manual order: they default to newest-edited first, like the library.
- Topic operations (`topics/operations.ts`) create, rename, nest, reorder, and delete topics, and edit a topic's blocks. Deleting cascades to the whole subtree but never deletes boards: any board under a removed topic returns to Unfiled. Server-side the delete is a grace-archive rather than a hard cascade (see [Deletion and recovery](#deletion-and-recovery)). Nesting is guarded against cycles.
- A topic page (`TopicView`) reads as a document: a subtopic-link row, the blocks in order (prose, and board groups as card grids of their members), then a trailing grid of any unplaced members, so a filed board never disappears. The editor (`TopicEditor`) commits a draft of the same blocks, picking boards from the topic's members and editing prose in place. It holds neither membership nor tree position: filing is the board editor's job, nesting the sidebar's.

### Tags and the browse surface

- The `library/` module is the browse home. A persistent `TopicSidebar` table of contents sits beside a content pane showing All Boards or one topic's page. The sidebar lists All Boards, the topic tree with disclosure controls, and a new-topic action. An Unfiled board (no home topic) simply appears in All Boards and under no topic; there is no separate Unfiled surface. Each row's quiet hover-revealed menu (`TopicRowMenu`) reorders the topic among its siblings or re-nests it, so nesting lives here, not in the editor.
- The card grid splits in two. `CardGrid` is the plain grid of `LibraryCard`s, used by a topic page's board groups and trailing grid. `BoardGrid` wraps it with the type and tag filters and serves the All Boards surface (`Library`) alone: a type control filters All / Positions / Sequences, and selecting tags narrows by intersection. Topic pages render through `CardGrid`, so they carry no filters by construction.
- Each `LibraryCard` is a button showing a small static court thumbnail (a Sequence shows its first step), the board's kind, title, a count (markers for a Position, steps for a Sequence), and its tag chips. `toLibraryItems` folds the boards into these cards newest-first.
- Opening a card leaves the browse surface entirely for the full-width view. The browse selection is held above the surface, so closing a board returns to the same place.

## Backend and access control

Boards and topics live in Supabase, not the browser. The access boundary is row-level security in the database: every read and write rule holds even if the client is bypassed, so the client is never trusted. `src/supabase/` holds the one browser client (carrying only the public URL and publishable key) and the row↔model mappers.

### Tables and the two spaces

- The schema is six tables: `profiles` (one per account, with a display name and the global-admin flag), `teams`, `memberships` (`(user, team, role)`, role `coach` or `player`), `topics`, `boards`, and `invites` (single-use invite links). Markers and steps are stored as JSON on a board.
- Every board and topic carries a `scope`: a **team** item belongs to a team's shared library; a **personal** item belongs to one user's private space. The client loads the active space and writes new content into it.
- A board also carries `owner` (its author), `author_locked`, `shared`, a `team_id` (the owning team, or a shared personal board's target), and an unguessable `share_token` minted server-side. The `owner` becomes null when its author's account is deleted, which reassigns their team boards to the team and clears the author lock.
- Boards, topics, teams, and profiles all carry soft-delete state. A removed board or topic is grace-archived (`deleted_at`/`deleted_by`) rather than dropped, and the every-space read queries filter `deleted_at is null`, so a deleted row is hidden everywhere but admin recovery. See [Deletion and recovery](#deletion-and-recovery).

### Who may do what

| Action                                  | Player | Coach        | Admin           |
|-----------------------------------------|--------|--------------|-----------------|
| View their team's library               | ✓      | ✓            | ✓ (every team)  |
| Create or edit team content             | —      | ✓ (own team) | ✓ (every team)  |
| Edit a team board its author has locked | —      | author only  | ✓               |
| Their own personal space                | full   | full         | full + god-mode |
| Invite a member                         | —      | ✓ (own team) | ✓ (any team)    |
| Create a team                           | —      | —            | ✓               |
| Delete their own account                | ✓      | ✓            | ✓               |
| Archive or delete a team                | —      | —            | ✓               |
| Restore deleted content or an account   | —      | —            | ✓               |

- RLS helper functions (`is_admin`, `is_team_member`, `is_team_coach`) run `security definer` so a policy can check membership without recursing. A `boards` guard trigger keeps `owner` immutable, except that an admin may reassign it and anyone may null it. Nulling orphans the board to the team and auto-clears the author lock. The trigger otherwise limits the author lock to the author and admins.
- An admin has full read/write across all teams and all personal content. This god-mode is a deliberate privacy trade-off for a small trusted group, called out in the README.

### Deletion and recovery

Removal is a grace-archive, never an immediate hard delete: a removed item is hidden from every normal view, kept three months for admin recovery, then purged. Four removals differ:

- **A board or topic** is soft-deleted in place. `deleteBoard` stamps `deleted_at`/`deleted_by`; `removeTopic` calls the `soft_delete_topic` RPC, which archives the whole subtree and returns its members to Unfiled, replacing the old `ON DELETE CASCADE`. Every space query filters `deleted_at is null`, so the row drops out of the library.
- **Removing a player** drops only their membership; their content is untouched (RLS already allowed it, no schema change).
- **A team** has two admin-only states: archive (`archived_at`, a reversible hidden state dropped from the space switcher) and delete (the `delete_team` RPC sets `deleted_at` and starts the purge clock). Delete flags only the team, so its content stays intact: restoring brings it back, purging cascades it away.
- **An account** deletes through the `delete-account` Edge Function: it bans the auth user and soft-deletes the profile. Their personal content is grace-archived; the team content they authored is reassigned to the team (`owner` becomes null), outside the recovery window. An admin restores within the window via `restore-account` (un-bans and clears the flag).
- **Purging** runs `purge_expired` (the `purge-expired` Edge Function) on a server-side schedule, hard-deleting boards, topics, and teams past three months. It is granted to `service_role` only, never reachable from a client. The admin panel (`src/admin/`) reads every recovery list through god-mode and drives the restores.

### Sharing and the share link

- Sharing a personal board sets `shared` and a target `team_id`; RLS then lets that team's members read it, and the owner can copy or move it into the team library (a coach of any team can copy a shared board in; only the owner can move their own).
- Every board has a `share_token`. The `board_by_token` function (`security definer`, granted to anonymous) resolves exactly one board from an exact token, but only a team board or a shared personal board, so an unshared board never leaks and the collection cannot be enumerated. `src/sharing/` holds the share dialog, the copy/promote actions, and the read-only `ShareView` reached by the `#/share/<token>` hash route.

### Auth, invites, and keep-alive

- Auth is invite-only email + password (`src/auth/`). An unauthenticated visitor reaches only the login screen, a valid share link, and a valid invite link. There is no open sign-up: an account is only ever created server-side, by the `invite` or `redeem-invite` Edge Function.
- Inviting by email creates an account and emails it, which needs a privileged server key, so it runs in a Supabase Edge Function (`supabase/functions/invite/`) that authorizes the caller from their own login before acting. Team creation and re-roling are plain client writes RLS allows. The email path is currently hidden in the UI (the built-in sender is rate-limited), so links are the only invite surface for now; the `invite` function stays in place for when it is restored.
- Inviting by link is the second invite path, for sharing through any channel (WhatsApp, etc.). A coach mints a single-use link (a row in `invites`, with the team, role, a 7-day expiry, and a server-minted token), shown in the team manager. The recipient opens `#/invite/<token>`: `invite_preview` (`security definer`, granted to anonymous) reveals the team and role only while the link is still valid, then they either join in one click if already signed in or set up an account with their own email and password. Redeeming runs in `supabase/functions/redeem-invite/`, which holds the secret key: it claims the link atomically (`update ... where used_at is null`, so two people racing one link see one winner), creates the account if the recipient is new, and adds the membership. `src/invites/` holds the client helpers, the `#/invite/<token>` route, and the `InviteAccept` screen.
- A scheduled GitHub Action (`.github/workflows/keep-alive.yml`) pings the database twice a week so the free-tier project never pauses.

## State, persistence, and the app shell

### Stores and persistence

- `useBoards` and `useTopics` hold the active space's board list and topic tree in React state and expose the mutations the UI calls. Both load from Supabase when the active space changes, scoped to it (a team's by team, the personal space's by owner), and write each edit through to the database. Edits apply optimistically so the UI stays responsive; a failed write surfaces an error and refetches to reconcile.
- The active space comes from `workspace/useWorkspace.ts`, which loads the user's teams, role per team, and admin flag, and tracks which space is on screen. The header space switcher moves between the personal space and each team.
- The stores keep curation honest. Filing or editing a board refreshes its `updatedAt`, so it leads its topic's newest-first order. Structural topic moves, such as reordering siblings or nesting from the sidebar, only touch the topic tree and never a board, so curation never churns the library's order. The first team's library is seeded once, server-side, by the setup seed.

### Navigation and the app shell

- `App` is the top-level owner of navigation and ties the stores together. A share link or invite link wins over everything, since both open with no account; otherwise an unauthenticated visitor sees the login gate. After sign-in two one-time gates can precede the app: an invite-email recipient sets a password (their account is created without one), and a first-time user sets a display name. Past the gates it chooses between three surfaces by precedence: a draft in the editor wins, otherwise an open board shows its view, otherwise the browse surface.
- Creating a board makes a single-step Position in the active space and opens it in the editor. Committing files the board into its chosen topic and returns to its view. Deleting a board, or a topic (which grace-archives the subtree and unfiles its boards), is confirmed first and stays recoverable by an admin within the window.
- The header carries the brand, the space switcher, a **Team** action (a team's coaches and admins manage roles and mint invite links), an **Admin** action (admins only, for teams, accounts, and content recovery), an **Account** action that opens a panel for the display name and sign-in email, the theme toggle, sign-out, and a **Delete account** action.

### Theme and typography

- `useTheme` drives a light or dark theme, defaulting to the system preference and persisting the choice. It sets a `data-theme` attribute on the document, and the whole interface is themed through CSS variables keyed off it.
- The type system pairs a display family for headings, a humanist sans for the UI, and a monospace for marker labels, and motion is kept restrained throughout with a single shared settle easing.

### UI components and styling

- The app chrome is built on Base UI primitives styled with Tailwind v4. `src/ui/` holds one thin wrapper per control (`Button`, `Input`, `Select`, `Combobox`, `Menu`, `Tabs`, `AlertDialog`, `Toolbar`, and the rest), and every surface renders through them, so each control has a single definition. Base UI gives the overlays correct keyboard, focus, dismissal, and screen-reader behaviour by construction. The shared class strings live in `src/ui/styles.ts`, and no surface styles a control ad hoc.
- Icons come from Lucide (`lucide-react`), since Base UI ships none. Every UI glyph is a Lucide component (`<Sun />`, `<ChevronRight />`, `<Play />`), never a hand-drawn `<svg>`, so the icon language stays consistent and new glyphs cost an import rather than a path. Two things stay hand-drawn: the domain art in `src/court/` (the volleyball, the woven net, the court lines) is illustration, not iconography, and the app's brand mark in the header is a custom court-grid glyph. The favicon (`public/favicon.svg`, linked from `index.html`) is that same court-grid mark on a dark tile keyed to the dark-theme background.
- Design tokens live in a Tailwind `@theme` layer in `src/index.css`: the fonts, the radius, shadow, and type scales, and the light and dark colours. The theme-swapping colours map onto runtime CSS variables, so a utility like `bg-panel` follows the theme switch with no `dark:` variants.
- The court keeps its own scoped raw CSS in `src/court/court.css`, the only non-Tailwind styling left.

## Deployment and operations

The front end ships as a static bundle on Cloudflare Pages. There is no application server, so every access rule stays in the database under row-level security, exactly as in development.

- **Host and URL.** The Vite build deploys to the Cloudflare Pages project `volleycoach` at `volleycoach.pages.dev`. No custom domain is attached yet. A `public/_redirects` rule (`/*  /index.html  200`) ships in the bundle so deep links, the share and invite routes, resolve to `index.html` instead of 404ing on a static host.
- **Pipeline.** `.github/workflows/deploy.yml` publishes the build with Wrangler, but only after CI passes on `main`. It runs on `workflow_run` (and manual `workflow_dispatch`) and checks out the exact commit CI verified, so only green `main` commits reach production. There are no automatic preview deploys.
- **Production configuration.** The build reads the Supabase URL and publishable key from GitHub Actions repository variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`), and the Cloudflare API token and account ID from secrets. Both Supabase values are public by design, since RLS is the guard, and keeping them as CI config rather than committed files lets a separate production project be introduced without a code change. The production URL is registered in Supabase's auth Site URL and redirect allow-list, so login, share, and invite links resolve back to the app.
