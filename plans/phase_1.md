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
