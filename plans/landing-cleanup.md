# Landing Page Cleanup

## Implementation Agent Instructions

- **Role**: Frontend engineer comfortable across the React client, the shared `src/ui/` token system, and Motion.
- **Task**: Clean up the logged-out landing page so its three showcase beats (hero drill, Tactics defence, Rotations editor) read as one visual system, and remove dead code and dead data.
- **Quality bar**:
    - Read @CLAUDE.md, @docs/style_guide.md, and the writing-style skill, and follow them to the letter.
    - Make minimal, contained changes. Do not restyle beyond what each requirement names.
    - Every control and shared value renders through `src/ui/` wrappers and tokens; do not add a one-off inline magic number where a token belongs.
    - Boards keep rendering through the app's own `Court` / `BoardView` surfaces so the landing cannot drift from the app.
    - Nothing on the landing page reads from or writes to Supabase.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @src/landing/LandingPage.tsx, @src/landing/ShowcaseBoard.tsx, @src/landing/RotationShowcase.tsx
    - @src/landing/exampleBoards.ts, @src/landing/useHeroPlayback.ts
    - @src/ui/styles.ts (`EYEBROW`, `TITLE`, `VIEW_BODY` tokens), @src/ui/CourtFrame.tsx
    - @src/editor/RotationPanel.tsx (the surface the rotation showcase reuses)
    - @src/court/motion.ts (shared easing/timing)
    - @tests/landing/LandingPage.test.tsx
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task. Before declaring done, re-read the section and restate every item verbatim as `- [ ] <item>`. If `_None._`, write `Follow-ups: none.`

## Plan

### Goals

- The three showcase beats share one visual system: equal court width, one heading-scale set, consistent section structure.
- No dead code or dead data in `src/landing/`.
- Header comments state only the non-obvious intent.

### Intent to preserve

- The **hero** is a played drill: the four-step "Serve receive & sideout" sequence keeps auto-looping as the motion teaser. Do not reframe it.
- The **rotation section** shows a coach *creating* a board, not a drill playing: the title and description typing and the one-at-a-time player drags are the point. Its board stays a single step. Keep that intent intact through every change below.

### Requirements

**R1 — Remove dead playback code.** `useHeroPlayback` returns `takeOver` and `restart` that nothing consumes, and its header comment describes a drag/scrub takeover that `ShowcaseBoard` never wires up. Remove both methods and the unused fields from the `HeroPlayback` type, and rewrite the comment to describe only the read-only auto-loop.

**R2 — Equalize the court width across the three beats.** The rendered court (the square `CourtFrame`) must be the same width in the hero, the Tactics section, and the Rotations section. Today they differ (roughly 560px hero, 620px Tactics, 545px Rotations) because each section sizes its court independently. Pick one court width and size each section's layout to hit it: the hero board container (`LandingPage.tsx`), the Tactics court column (the `VIEW_BODY` grid in `ShowcaseBoard`), and the Rotations court column (the grid in `RotationShowcase`). Outer section widths may still differ, because the lower two sections place a right-hand column (description / rotation panel) beside the court that the hero does not have. Align the courts, not the section containers. Replace the inline `min(960px,…)` / `min(940px,…)` magic widths with a shared token where the alignment makes them equal.

**R3 — Use one heading-scale set.** Collapse the four display-heading sizes to: the hero `h1` scale, one section `h2` scale, and the shared `TITLE` token for board titles. `RotationShowcase` must drop its near-duplicate `TITLE_TEXT` and render the board title through the shared `TITLE` token.

**R4 — Drop the dead editor buttons in the rotation demo.** Remove the two disabled, greyed-out Undo/Redo `IconButton`s from the rotation demo's editor row. Keep the title `Input` and the `Done` button: they carry the "this is the real editor" cue that the section depends on.

**R5 — Sublines are content, not symmetry.** A section shows a subline under its heading only when the subline carries real content. Do not add a subline to a section purely to match another section's structure. Keep the heading-to-board vertical rhythm consistent whether or not a subline is present, through spacing, so an absent subline does not read as a layout gap.

**R6 — Rotation demo lays out cleanly on mobile.** At a 390px viewport the rotation demo's editor row must not clip: with the Undo/Redo buttons gone (R4), the title field and `Done` fit without squeezing, and the court, rotation panel, and description stack legibly. The rotation section must not be disproportionately tall relative to the other beats.

**R7 — Remove dead board data.** Delete the `rotation` field on the hero drill board's first step (`exampleBoards.ts`). The hero renders no rotation overlay, so the field never shows.

**R8 — Share the rotation animation easing.** The rotation demo's hand-rolled animation loop stays (it recomputes the overlap live and drives the typing), but its easing and timing must come from the shared `court/motion` module so its glide matches the rest of the app's motion. Remove the loop's private easing constants in favour of the shared ones.

**R9 — Trim header comments.** Cut the paragraph-length header comments in `LandingPage.tsx`, `ShowcaseBoard.tsx`, `RotationShowcase.tsx`, and `exampleBoards.ts` to two or three lines that state only the non-obvious intent. Drop narration the code already shows and any stale description.

**R10 — Add a closing call to action.** Place one restrained "Try it now" call to action above the footer, opening the no-account sandbox through the same `openTry` path as the hero. It is the only call to action below the fold.

### Non-goals

- The landing-local `usePrefersReducedMotion` hook stays where it is.
- The hero section's `min-h-[calc(100dvh-5rem)]` offset stays as written.

### Testing

- Update `tests/landing/LandingPage.test.tsx` to cover the closing "Try it now" call to action: it renders and opens the sandbox. Keep the existing landing tests green.
- The remaining changes are visual and structural with no new behavioural surface; add no tests beyond what the above requires. Use the `react-testing` skill for any test work.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- The court renders at one shared width across the hero, Tactics, and Rotations sections.
- Board titles across the showcase render through the shared `TITLE` token; `TITLE_TEXT` is gone.
- The rotation demo shows no disabled Undo/Redo buttons and keeps its title field and `Done`.
- The hero drill board carries no `rotation` field; it still auto-loops its four steps.
- The rotation board is still a single step, and its create-a-board intent (typing, dragging) is intact.
- The rotation demo's editor row does not clip at 390px.
- `useHeroPlayback` exposes no unused methods.
- A "Try it now" call to action sits above the footer and opens the sandbox.

## Follow-ups

*None.*

## Implementation Notes

All ten requirements landed in the four landing files plus the test. Diagnostics (typecheck, lint, format), the full test suite (629 passing, including the new closing-CTA test), and a production build all pass. The new hero court width `max-w-[min(74vh,620px)]` is confirmed present in the generated CSS.

- **R1 (dead playback code).** Dropped `takeOver`/`restart` from `HeroPlayback` and the return value in `useHeroPlayback.ts`, and rewrote the header to describe only the read-only auto-loop.
- **R2 (equal court width).** Picked the app's canonical court width `min(74vh,620px)` as the shared width, so the Tactics court (already on `VIEW_BODY`) is the reference.
    - Hero board container now caps at `max-w-[min(74vh,620px)]` (its full-width Sequence court fills it).
    - The Rotations court column now reuses the shared `VIEW_BODY` grid, whose first track is `min(74vh,620px)`, so its court matches exactly and it stacks below 1040px.
    - The two lower sections' outer widths are now one shared token: `SECTION_BOARD` (`min(960px,92vw)`) is used for both the Tactics and Rotations containers, replacing the old inline `min(960px,…)`/`min(940px,…)`. The court width itself stays the inline `min(74vh,620px)` literal, matching the app's own `VIEW_BODY`/`CourtFrame` usage, because Tailwind can only generate arbitrary-value classes from complete literal strings, not from a composed variable.
- **R3 (one heading-scale set).** Deleted `TITLE_TEXT` from `RotationShowcase` and rendered its view-header board title through the shared `TITLE` token. This is also more faithful to the app: `BoardView` already heads with `TITLE` while the editor field uses `Input variant="title"`, so the view-to-edit swap legitimately changes size, exactly as in the real editor.
- **R4 (dead editor buttons).** Removed the two disabled Undo/Redo `IconButton`s (and the now-unused `IconButton`, `Undo2`, `Redo2` imports). The title `Input` and `Done` button stay.
- **R5 (sublines are content).** Left Tactics with no subline (it reserves no empty space, so there is no gap to read). The Rotations narration is real, animation-tracking content and stays. Both sections share the same `SECTION` heading→content rhythm.
- **R6 (mobile rotation layout).** With Undo/Redo gone, the editor row is `Input` (flex-1) + `Done` (flex-none) and fits at 390px without squeezing. The `VIEW_BODY` grid stacks to a single column below 1040px, so court, rotation panel, and description stack legibly.
- **R7 (dead board data).** Removed the `rotation` field on the hero drill board's first step.
- **R8 (shared easing).** Replaced the private `easeInOut` cubic with the app's shared `EASE_SETTLE` curve, evaluated through `cubicBezier(...EASE_SETTLE)` from Motion, so the rotation glide matches the rest of the app's motion.
- **R9 (trim header comments).** Cut the paragraph-length headers in all four files to two or three lines of non-obvious intent.
- **R10 (closing CTA).** Added one restrained closing section above the footer: a `SECTION_H2` heading and a `ghost` "Try it now" button calling the same `openTry` path as the hero. It is `ghost`, not `primary`, to keep the single-primary-per-view rule (the hero's "Build a board" is the view's one primary); it is sized to match the hero CTA's presence. A new App-wiring test asserts it renders and opens the sandbox.

### Critical Issues

None.
