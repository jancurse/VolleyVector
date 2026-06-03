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
