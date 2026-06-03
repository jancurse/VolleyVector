# Phase 1: The Product, Working in Dev

## Implementation Agent Instructions

- **Role**: A frontend engineer building a polished, SVG-based interactive React app, where look and motion are the product itself.
- **Task**: Build the Phase 1 app entirely client-side — the court, the tactic editor, drills with playback, and the library — one stage at a time, until it genuinely feels good in dev.
- **Quality bar**:
    - Read @CLAUDE.md and @docs/style_guide.md and follow them to the letter. Make minimal changes and keep the code clean and easy to maintain.
    - Looks are a feature. The look should be clean, minimal, and restrained, and the motion simple but effective — the polish of 3blue1brown's Manim animations (smooth easing, purposeful movement, nothing decorative). Light and dark themes and the colour palette are your call.
    - Honour the spine decisions in @plans/project_overview.md: normalized 0–1 coordinates, stable marker identity across steps, one court component for both modes, SVG.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @plans/project_overview.md
- **How to work — stop and discuss at every stage**:
    - **One stage at a time.** Implement only the stage you were asked for. Do not start, scaffold, or "prepare for" later stages, even if they seem trivial. Finishing a stage early is not licence to begin the next one.
    - **Work in interactive rounds.** Each stage is a loop, not a single hand-off:
        - Ship an initial cut independently — make the reasonable calls yourself and get a working version on screen without stopping to ask about every detail.
        - Stop and hand it to the user. Let them play with it, react to it on screen, and decide the details, interactions, and look together with you. Do not pre-empt those decisions or polish them away before they have seen it.
        - Refine through back-and-forth until the user is satisfied, then — and only then — treat the stage as done.
    - **Settle open details with the user**, not alone. When in doubt, ship a sensible default and surface it for them to react to.
    - **Do not run ahead.** When a stage is done, stop and wait for the user to point you at the next one.

## Plan

In Phase 1 we build the entire interactive app client-side, with no backend, accounts, or deployment, and refine it until it genuinely feels good to use. This plan fixes what to build and the order to build it in; the how — component structure, state approach, libraries, and the exact interactions and visuals — is settled with the user through the review rounds above, not pinned down here.

### Goal

A coach can build, browse, and play back tactics and drills entirely in the browser, and the whole thing looks and moves beautifully. State persists locally (localStorage) so a real library accumulates across reloads.

### Out of scope

- Backend, accounts, auth, share links, and deployment (Phases 2–3).
- The final tag taxonomy, court geometry, and role/label conventions are not settled yet. Placeholders are fine for now, and we lock them in as we build.

### Stages

Build in order. Each stage is shippable and reviewed before the next.

- **Stage 1 — The look: static court + markers.**
    - Render the court and a set of markers beautifully, with no interaction yet.
    - This locks the visual language everything inherits — court, marker shapes, role colours and labels, typography, spacing, and the overall motion feel. Get it right before building features on top of it.
- **Stage 2 — Tactic editor.**
    - Place, drag, label, and recolour markers, and edit a markdown description.
    - Create, edit, and delete tactics, persisted to localStorage.
- **Stage 3 — Drills and playback.**
    - Author a drill as ordered steps, each with its own instruction and marker positions.
    - Step through the steps, and play them back as a smooth animation with auto-derived movement arrows (markers matched by identity).
- **Stage 4 — Library.**
    - Browse all saved tactics and drills, and filter by their organising tags.
    - Open any item into the editor or playback.

### Acceptance Criteria

- Tactics and drills can be created, edited, browsed, and played back entirely in dev, and they persist across reloads.
- The look and motion feel polished enough to be the product's selling point.
- Each stage was reviewed and accepted by the user before the next one began.

### Testing

Cover the changed behaviour with unit tests as each stage lands — no more than the changes require. Use the react-testing skill for frontend tests, and the diagnostics skill to confirm formatting, linting, and type-checking pass.

## Progress

### Stage 1 — done

Built and accepted: the static court and markers render in both themes and the visual language is locked.

- **Shipped**
    - One config-driven `Court` SVG component (surface, front zone, boundary, attack line, woven net) and a `Marker` component (role discs + a seamed ball), sharing the same inputs both modes will use.
    - Normalized 0–1 coordinate system (`court/geometry.ts`), a fixed role palette and labels (`court/roles.ts`), and a documenting `Legend`.
    - Light/dark themes (`theme/useTheme` + CSS variables), the Bricolage / Hanken / JetBrains Mono type system, and a single restrained CSS entrance animation.
    - A showcase page rendering a perimeter defence against an outside attack, covered by unit tests (geometry, roles, court rendering).
- **Locked**
    - Default court extent: one half-court (net plus the 3 m attack line), square 9×9.
    - White marker labels on a theme-stable role palette; theme defaults to system preference, falling back to dark.

### Stage 2 — done

Built and accepted across several review rounds: a coach can create, edit, view, and delete tactics entirely in the browser, persisted to localStorage, behind a polished view/edit flow.

- **Shipped**
    - **The tactic editor.** Add markers from a palette; drag them (pointer, with a lift) or nudge a selected one with the arrow keys; select with a calm accent halo; recolour by role; rename labels; and write a markdown description with a Write/Preview toggle.
    - **Data model and persistence.** A `Tactic` (title, markdown description, court mode, markers, timestamps) with pure operations (`makeMarker` with label numbering and bench placement, `setMarker`, `removeMarker`, `createTactic`) and a `useTactics` store backed by localStorage — seeded with a "Base defence" sample, debounced saves, and a reseed on first run or corrupt data.
    - **One court, two roles.** `Court` gained optional selection/drag props so the same component renders read-only or editable; `useMarkerDrag` maps pointer to normalized coordinates through the SVG screen matrix, clamped to the court plus a free-zone reach so the ball can sit over the net.
    - **View-first flow.** Opening an item lands in a read-only `TacticView` (read-only court, the description rendered in a card, and an Edit button — the surface players and share-link visitors will get). Editing is a focused full-width mode with **Cancel** (discard) and **Done** (commit) over a working draft; a minimal tactics rail lists, creates, and selects; delete sits in the editor behind a confirm.
    - **Court modes and colours.** A per-tactic **Positions / Basic** toggle by the board swaps the palette between volleyball roles and generic Coach/Player markers (numbered C1, P1…); in basic mode a curated colour picker recolours markers (e.g. two teams). New markers land on a "bench" row below the court and reuse freed slots.
    - **Tests and tooling.** `react-markdown` renders descriptions; 68 unit tests cover the pure operations, storage, geometry, and the full App view/edit and editing behaviours; format, lint, type-check, and build are green.
- **Locked**
    - **View-first, commit-on-Done.** Open into the read-only view; coaches Edit into a draft, where Done commits and Cancel discards (no autosave mid-edit). Editing is full-width with the rail stepped aside; the layout is capped (~1320, court 560 + description ~728) and the description card is shared by both modes.
    - **Per-tactic court mode**, defaulting to Positions; the mode only filters the palette and inspector and never rewrites existing markers.
    - **Labelling (placeholder).** Outside/middle/coach/player auto-number; setter/opposite/libero stay bare until duplicated; the ball is unlabelled. Role drives colour, with an optional per-marker colour override in basic mode (a single player colour for now).
    - Removed the now-superseded Stage-1 `Legend`; the palette documents the roles.

### Stage 3 — in review

Built across several review rounds and still open for sign-off: a coach can author a drill as ordered steps, step through it, and play it back with identity-based animation and auto-derived movement arrows, persisted to localStorage.

- **Shipped**
    - **Drill data model.** A `Drill` (title, markdown description, court mode, shared marker identities, ordered steps, timestamps) where identity (`id`/role/label/colour) is stored once and each `DrillStep` holds a markdown instruction plus a `markerId → normalized position` map — positions vary per step, identity does not. Pure ops in `drills/operations.ts` (`createDrill`, `stepMarkers`, `stepMoves`, `insertStep`, `moveStep`, `removeStep`, `setStepInstruction`, `setStepPosition`, and `addMarker`/`setMarker`/`removeMarker` spanning every step), behind a `useDrills` localStorage store under `volleycoach-drills`, seeded with a 3-step "Serve receive to outside" sample.
    - **One court, now animated.** `Court` gained `animated` (markers glide between steps via Motion) and `arrows` (a derived-movement overlay) props; the editor/static path is unchanged (instant, drag-exact). `Arrows` draws straight inset arrows with a minimum-length guard so near-overlapping moves don't render degenerate arrows.
    - **Auto-derived movement arrows.** `stepMoves` diffs consecutive steps by marker identity; `arrowsForStep` colours each (players by role/colour, the ball by a theme-adaptive neutral `--ball-arrow`). No arrow data is ever authored or stored.
    - **Playback.** `useDrillPlayback` tracks the shown step and play/pause; play advances on a clock (≈0.7 s glide + ≈1.1 s dwell) and stops at the last step. `DrillView` is the read-only surface — animated court, transport (prev / play-pause / next + counter), a clickable step scrubber, and the current step's instruction as crossfading markdown. Reduced motion is honoured via `MotionConfig`.
    - **Drill editor.** `DrillEditor` edits a draft one step at a time, tracking the active step by **id** so insert/reorder/remove never lose the place. Position edits (drag, arrow keys) touch only the active step; identity edits (role/label/colour/add/remove) span every step. The steps strip selects steps, **inserts a step after the current one** (cloning its positions), reorders the active step with `‹ ›`, and removes (keeping ≥ 1). Reuses the palette, inspector, marker drag, and description editor.
    - **Markdown instructions and layout.** `DescriptionEditor` was generalised (title / placeholder / compact) and reused for both the drill description and each step's instruction. In the view the right column shows the short description on top with the current Step N instruction below it.
    - **Ball.** Redesigned from the cream disc to a blue/yellow ball (no white) so it reads on both themes.
    - **App.** A Tactics / Drills switch in the rail toggles parallel browse/view/edit worlds; the tactics flow is unchanged. Added `motion` as a dependency.
    - **Tests and tooling.** 97 unit tests cover the pure drill operations, storage, the playback hook, and the App drills flow; format, lint, type-check, and build are green.
- **Locked**
    - **Separate Drill content type**, parallel to tactics behind a switch; the unified, tag-filtered library is Stage 4 and stays out of scope.
    - **Identity shared across steps, positions per step** — the spine decision, encoded directly in the model.
    - **Arrows are derived, never authored.** Shown in playback (the upcoming move while paused) and on the editor's active step; you shape them only by moving markers.
    - **`+ Step` inserts after the current step** from its positions; **reorder is via `‹ ›` buttons** (not drag); the active step is tracked by id.
    - **Step instructions are markdown**; the view stacks the short description above the current step's instruction.
    - **Playback** glides ≈0.7 s with a ≈1.1 s dwell and stops at the last step (no loop).
- **Open / deferred**
    - **Arrows are not hand-editable** (create/edit/remove). The user wants to revisit this later; not built.
    - **Small moves draw no arrow.** A move below ~0.14 normalized (e.g. the sample's MB1 at 0.05) clears the two 46-unit discs by less than an arrowhead's room, so the disc-clearance guard in `Arrows` skips it. The threshold is tunable if we later want tiny moves indicated.
    - **The ball is similar to Mikase v200w but not a copy**
    - **Showing arrows in the editor** was added in response to a question rather than an explicit request; kept for now, trivially revertible to playback-only.

### Stage 4 — in review

Built as an initial cut and handed over for review: a coach browses every tactic and drill together in one library, filters by content type and organising tags, and opens any item into its view, playback, or editor.

- **Shipped**
    - **Organising tags on the model.** `Tactic` and `Drill` each gained a free-form `tags: string[]`; `createTactic`/`createDrill` start empty, the localStorage loaders default older saved data to `[]`, and the two samples seed representative tags (the tactic `Defence` / `Outside attack`, the drill `Serve receive` / `Outside attack`).
    - **The library home.** A new `Library` (`src/library/`) replaces the per-collection rail as the landing surface: a responsive grid of cards, each a static court thumbnail (the same `Court` component, drawn small — a drill shows its first step) above the title, type, count, and tag chips. `toLibraryItems` folds both collections into one list newest-first; `collectTags` feeds the filter and `allTags` the editors' autocomplete.
    - **Filtering.** A type segmented control (All / Tactics / Drills) sits beside a row of tag chips; selecting tags narrows by intersection (an item must carry every selected tag), and an empty result shows a distinct "nothing matches" vs. "nothing yet" message.
    - **Navigation.** The app moves library → read-only view → editor, with a precedence of draft over open-item over library; each view gained a **← Library** back button, and committing or deleting a draft returns to the right surface. Removed the now-superseded `CollectionSwitch`, `TacticList`, and `DrillList` and their rail CSS.
    - **Tag editing with autocomplete.** A shared `TagEditor` in both editors lists removable chips and commits a new tag on Enter, comma, or blur; as you type it offers matching existing tags from across the whole library (a themed drop-down, navigable by ↑/↓ + Enter), so a near-duplicate is reused rather than retyped, while a brand-new name still commits as typed.
    - **Tests and tooling.** 108 unit tests cover the library helpers, tag storage migration, and the App library/filter/tag/autocomplete flows (the App suite was rewritten for the new navigation); format, lint, type-check, and build are green.
- **Locked**
    - **One unified library, not two rails.** The library is the home screen; browsing, viewing, and editing are full-width surfaces reached from it, not a persistent sidebar.
    - **Open into the existing view/editor.** Cards route into the unchanged `TacticView`/`DrillView` (and from there the editors), so playback and editing are inherited rather than rebuilt.
    - **Thumbnails are static snapshots** (a drill's first step), with no playback or hover preview on the cards.
    - **Tag-filter intersection (AND).** Selecting more tags narrows; an OR/union mode was considered and not built.
- **Open / deferred**
    - **Flat tags, not structured dimensions.** The plan names category / situation / session but records the taxonomy as deferred, coach-managed content, so tags are a single free-form list per item for now; making those distinct, separately-filterable dimensions is a deliberate later call.
    - **Tag-row overflow is unaddressed.** The chip row could grow unwieldy as tags accumulate; left alone while the overall library layout is still under discussion.
