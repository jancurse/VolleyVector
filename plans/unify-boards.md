# Unify Tactics and Drills into one Board content type

## Implementation Agent Instructions

- **Role**: A frontend engineer refactoring a polished SVG-based React app, collapsing two near-duplicate content types into one without regressing look or motion.
- **Task**: Replace the separate `Tactic` and `Drill` types — and their stores, editors, and views — with a single `Board` type, where a board with one step is a *Position* and a board with two or more steps is a *Sequence*.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature. This is a consolidation: prefer deleting duplicated code over adding new code.
    - Write clean, easy-to-maintain code.
    - No visual or motion regressions: a Position must look and behave exactly like today's tactic view/editor, and a Sequence exactly like today's drill view/editor.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @plans/project_overview.md
    - The code being merged: `src/tactics/`, `src/drills/`, `src/editor/`, `src/library/`, `src/App.tsx`.
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`. If the section is `_None._`, write `Follow-ups: none.` Do not implement follow-ups unless explicitly asked.

## Plan

### Goal

One content type — a **Board** — replaces the `Tactic` / `Drill` split. A board carries marker identities and an ordered list of steps (always ≥ 1). Static vs. animated is no longer a stored type but a property derived from step count:

- **Position** — a board with exactly one step. Renders and edits like today's tactic: a static court, no transport, description only.
- **Sequence** — a board with two or more steps. Renders and edits like today's drill: animated court, transport and scrubber, per-step instructions, auto-derived arrows.

There is no "tactic or drill?" choice at creation. Every board starts as a single-step Position; adding a step promotes it to a Sequence in place.

This brings the client model in line with the already-planned Phase 2 backend, which `project_overview.md` describes as a single `items` table with markers and steps stored as JSON.

### Non-goals

- No change to the court, marker, arrow, geometry, palette, inspector, drag, theme, or playback internals — only the types/stores/editors/views that wrap them.
- No change to the tag system, autocomplete, or filtering mechanics beyond renaming the type filter's options.
- No new authoring capability. This is a consolidation, not a feature.

### The model

A single `Board` type, structurally the current `Drill`:

- `id`, `title`, `description` (markdown), `mode`, `tags`, `createdAt`, `updatedAt`.
- `markers`: stable marker identities shared across steps (today's `DrillMarker` — `Omit<Marker, "position">`).
- `steps`: an ordered, non-empty list of `{ id, instruction, positions }`.

A Position is simply a board whose `steps` has length 1. Derive a helper (e.g. `isSequence(board)` / `kindOf(board)`) rather than storing a kind. The current `Tactic` type and its separate marker-list shape are removed; tactic data folds into a one-step board.

### Stores and operations

- One store (`useBoards`, localStorage key e.g. `volleycoach-boards`) replaces `useTactics` and `useDrills`.
- One operations module replaces `tactics/operations.ts` and `drills/operations.ts`. The drill operations are the superset and carry over; tactic-only helpers either disappear or become the single-step case.
- Seed the store with **both** existing samples so each kind is represented: the one-step "Base defence" Position and the three-step "Serve receive to outside" Sequence.
- **One-time migration, no lingering code.** Perform a one-time migration of any data under the old `volleycoach-tactics` / `volleycoach-drills` keys into the unified store (tactics → one-step boards, drills → boards) and remove the old keys. The *committed* loader must read only the new key and reseed from samples when it is absent — it must contain no code that reads, falls back to, or version-migrates the old keys. How the one-time conversion is run (a throwaway step the implementer executes and removes) is the implementer's call, but the shipped code carries no backward-compatibility path.

### Editor and view

- One `BoardEditor` replaces `TacticEditor` and `DrillEditor`. It is the drill editor generalised: the steps strip and step-instruction box appear only once a board has ≥ 2 steps; a single-step board shows an **Add step** affordance that promotes it to a Sequence (cloning the current positions, as `+ Step` does today). Position edits touch the active step; identity edits span every step. Removing steps down to one returns it to a Position.
- One `BoardView` replaces `TacticView` and `DrillView`. With one step it renders the static, transport-free view; with ≥ 2 steps it renders the animated court, transport, and scrubber. The description always shows; the current step's instruction shows below it only for a Sequence.

### Library

- `toLibraryItems` maps over the single board list. `kind` is derived: one step → `"position"`, else `"sequence"`. A card's meta reads "N markers" for a Position and "N steps" for a Sequence; the thumbnail is the first step.
- The type segmented control becomes **All / Positions / Sequences**, filtering on the derived kind.
- Tag collection, autocomplete (`allTags`), and intersection filtering carry over against the one list.

### App flow

- Collapse the parallel tactic/drill draft and open state into one board draft and one open id — no `LibraryKind` discriminator on navigation. Library → read-only `BoardView` → `BoardEditor`, with draft taking precedence over an open board over the library, as today.
- "New" creates a single-step board (a Position) and opens it in the editor.

### Naming

- The stored type and primary noun is **Board**.
- Derived kinds surfaced in the UI: **Position** (one step) and **Sequence** (≥ 2 steps).

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill for frontend tests.

- Port the existing tactic/drill operation, storage, and playback tests onto the unified model rather than keeping both suites.
- Cover the promote/demote boundary: a one-step board is a Position; adding a step makes it a Sequence; removing back to one step makes it a Position again.
- Update the App and library tests for the unified navigation and the All / Positions / Sequences filter.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- A single `Board` type backs all content; `Tactic`/`Drill` types, stores, editors, and views no longer exist.
- A Position looks and behaves exactly like the former tactic view/editor; a Sequence exactly like the former drill view/editor.
- The library browses, filters (All / Positions / Sequences), and opens both kinds from one list.
- Adding a step to a Position promotes it to a Sequence in place; removing steps back to one demotes it.

## Follow-ups

*None.*

## Implementation Notes

### Critical Issues

- **Legacy data migration was a one-time, throwaway step run in the browser — no migration code remains in the repo.**
    - Old data lives only in per-browser `localStorage` (`volleycoach-tactics` / `volleycoach-drills`); this environment cannot reach the user's real browser. The committed loader (`src/boards/storage.ts`) reads only `volleycoach-boards`, returns `null` when absent so `useBoards` reseeds from `SAMPLE_BOARDS`, and contains no read of, fallback to, or version-migration of the old keys.
    - The user converted their existing data once via a console snippet (tactics → one-step boards, drills → boards), confirmed their boards came across correctly, and the migration code was then removed.

### Key Decisions

- **`Board` is structurally the old `Drill`.** `BoardMarker = Omit<Marker, "position">` and `BoardStep` carry over verbatim; the old `Tactic` (flat `Marker[]`) folds into a one-step board whose single step holds the positions. The "Base defence" sample was rewritten in this shape.
- **Kind is derived, never stored.** `isSequence(board)` (steps > 1) lives in `boards/types.ts`; the editor, view, and library all branch on it. The library's `LibraryKind` is `"position" | "sequence"`, derived in `toLibraryItems`.
- **One operations module, the drill superset.** `boards/operations.ts` keeps the tactic building blocks (`nextLabel`, `makeMarker`) — needed by `addMarker` — and the full step/marker transforms from drills, renamed `Drill`→`Board`. The tactic-only marker-array `setMarker`/`removeMarker` were dropped (only the old `TacticEditor` used them); the board-level versions replace them.
- **The loader carries no defaulting.** Since the new key is only ever written by `saveBoards` (always including `mode`/`tags`) and there is no legacy path, the old `?? "positions"` / `?? []` normalisation was removed; `loadBoards` round-trips exactly.
- **The Add step affordance is the one intentional addition to the Position editor.** The plan mandates it: a single-step board renders just a `+ Add step` button (aria-label `Add step`) in the steps-strip slot; at ≥ 2 steps that slot becomes the full `StepStrip` and the per-step instruction box appears. Everything else in the Position editor/view is byte-for-byte the old tactic editor/view; the Sequence editor/view is the old drill editor/view.
- **`BoardView` calls `useBoardPlayback` unconditionally** (harmless for one step: `last` is 0) and then branches its body markup, so the rules of hooks hold while each branch preserves the former view's exact DOM/classes.

### Verification

- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` all pass.
- `npm run test` — 101 passed (8 files). Ported the tactic/drill operation, storage, and playback suites onto the unified model (no duplicate suites), added the promote/demote boundary at both the unit level (`isSequence` after `insertStep`/`removeStep`) and as an App integration test, covered the legacy migration, and updated the App + library tests for the unified navigation and the All / Positions / Sequences filter.
- Checked on screen with Playwright: the library (Boards / + New board / All·Positions·Sequences, both cards with derived meta), the Position view and editor (static court, `+ Add step`, no strip), promoting in place to a Sequence (step chips + Step instruction appear), and the Sequence playback view (animated court, derived arrows, transport, scrubber) — all visually faithful to the former tactic/drill surfaces.
