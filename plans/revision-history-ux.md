# Revision-history UX fixes

## Implementation Agent Instructions

- **Role**: Frontend engineer fluent in React 19, Tailwind v4 (including container queries), and this app's `src/ui/` token system.
- **Task**: Fix three UX defects in the board and note revision-history surface: a crushed preview description on desktop, a list-above-preview scroll trap on mobile, and a detached Restore action.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - No handpicked style values: reuse existing tokens/scale; if a new shared value is genuinely needed, add a named token rather than inlining an arbitrary one.
    - The normal full-width `BoardView` (the board's own view and the share page) must look and behave exactly as before; only its behaviour inside a narrowed container may change.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @src/history/BoardHistory.tsx
    - @src/history/NoteHistory.tsx
    - @src/history/RevisionList.tsx
    - @src/editor/BoardView.tsx
    - @src/ui/styles.ts
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` per its section description.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects — do not implement them. Restate every item verbatim in your final message; if none, write `Follow-ups: none.`

## Plan

### Goal

The revision-history surface (`BoardHistory`, `NoteHistory`) pairs a `RevisionList` with a read-only preview. Three defects make it read poorly:

1. **Crushed preview description (board, desktop).** `BoardView`'s internal court+description grid (`VIEW_BODY`) stacks at a viewport breakpoint (`max-[1040px]`). In history the preview sits in a ~600px column at a wide viewport, so the viewport query never fires: the court and description stay side by side in a narrow space and the description wraps to roughly one word per line. It reads worse at 1280px than at 900px.
2. **List-above-preview scroll trap (board + note, mobile).** When the outer history grid stacks (`max-[900px]`), the full revision list renders above the preview, so on a phone the user scrolls past every row (each trailed by its own Restore link) before reaching the snapshot they selected. A long history pushes the preview far down.
3. **Detached Restore action (board + note).** "Restore this version" floats below each past row, outside the row's card, loosening the row-to-action association and stacking one link under every past revision.

### Requirements

- **Fix 1 — preview stacks on its own width.**
    - `BoardView`'s court+description body must decide its one-column vs two-column layout from its own container width, not the viewport, so that when embedded in history's narrowed preview column it stacks (court above description, description at full readable width) exactly as it already does at a narrow viewport.
    - Use a Tailwind v4 container query: mark the view body a container and replace the `max-[1040px]` layout breakpoints in `BoardView` with the matching container variant, keeping the same 1040px threshold so full-width behaviour is unchanged.
    - Scope to `BoardView` only. `BoardEditor`'s own `max-[1040px]` breakpoints are out of scope (the editor is never embedded in a narrowed column).
    - Notes need no equivalent: `NoteHistory`'s preview is a single-column document, not a nested two-column layout.
- **Fix 2 — collapsible list when stacked.**
    - When the history layout is stacked (narrow), `RevisionList` is a collapsible disclosure: collapsed by default, its summary naming the surface and showing how many revisions, so the preview sits directly below the summary rather than below the whole list.
    - When the layout is two-column (wide), the list shows in full with no disclosure affordance — the same as today.
    - Use the app's existing `<details>`/`<summary>` idiom (as `RotationViewPanel` does). The collapse is presentation only; selection, current marking, and restore behaviour are unchanged.
- **Fix 3 — Restore inside the selected row.**
    - The Restore action renders inside the revision row's card, not detached below it.
    - It appears only on the currently selected revision when that revision is a past one (not the current revision and not when the viewer lacks edit rights). Selecting a row previews it; the restore action for that previewed version then sits in its row. Non-selected rows show no Restore action.
    - Wording stays "Restore this version"; it remains a quiet control (`Button variant="text"` or equivalent quiet style per the style guide).

### Non-goals

- No change to how restoring works (still commits the snapshot as a new revision, append-only) or to the revision-loading hooks, diff, or summaries.
- No redesign of the desktop two-column history layout beyond the three fixes.
- No change to `BoardEditor`'s responsive breakpoints.

### Constraints

- Take every dimension, radius, and type value from `src/ui/styles.ts` tokens and the `src/index.css` `@theme` scale; do not inline arbitrary values.
- `RevisionList` is shared by `BoardHistory` and `NoteHistory`; its changes (Fixes 2 and 3) must serve both.

### Open Issues

_None._

### Testing

- Add or update unit tests under `tests/history/` covering the changed `RevisionList` behaviour: Restore appears only on the selected past revision and not on the current or unselected rows, and is absent entirely when `onRestore` is not provided. Use the `react-testing` skill.
- Layout/responsive behaviour (container-query stacking, disclosure collapse) is verified visually in the review step below, not by unit tests.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- On a desktop-width viewport, the board history preview's description reads at a normal width (no one-word-per-line wrapping); the preview stacks court-above-description inside the narrowed column.
- On a narrow viewport, the revision list is collapsed by default and the preview sits directly beneath its summary.
- The Restore action sits inside the selected past revision's row; no detached restore links remain, and the current revision shows none.
- The full-width board view and share page are visually unchanged from before.

### Review (user-steps, with the agent)

After implementation and passing diagnostics, run a `/user-steps` review so the user can eyeball all three fixes. The agent does the setup; the user only clicks a link.

- The agent seeds a **temporary** 4-change revision history on one local seeded board (local Supabase only, never production), exactly as was done during the original review (insert chained `board_revisions` rows + point `current_revision_id` at the newest). This is throwaway test data.
- The agent ensures `npm run dev` is running and hands the user the localhost link plus the exact path: open the seeded board → overflow menu → **History…**.
- The user checks, at a wide window and a narrow one: the description reads normally on desktop, the list collapses on mobile with the preview right below it, and Restore sits inside the selected row.
- After the user confirms, the agent offers to reset the local DB (`npm run db:reset`) to drop the temporary revisions. Nothing seeded is permanent.

## Follow-ups

_None._

## Implementation Notes

- **Fix 1 (preview stacks on its own width).** Marked `BoardView`'s root flex wrapper a container (`@container`) and converted its three viewport breakpoints to the matching container variant at the same threshold: `VIEW_BODY`'s `max-[1040px]:grid-cols-[minmax(0,1fr)]` → `@max-[1040px]:…`, and both `CourtFrame`s' `max-[1040px]:justify-self-center` → `@max-[1040px]:…`. The root wrapper's width tracks the column `BoardView` is placed in, so in history's ~600–970px preview column the body stacks (court above description, description full width) while the full-width view keeps the 1040px split. `BoardEditor` was left untouched (out of scope). Verified in the built CSS: `container-type:inline-size` and `@container not (min-width:1040px)` both emitted.
- **Fix 2 (collapsible list when stacked).** `RevisionList` is now a `<details>`/`<summary>` disclosure (the `RotationViewPanel` idiom): summary names the surface and shows the revision count, with a `group-open` chevron. Below 901px it is collapsed by default and toggles; at ≥901px the count and chevron are hidden, the summary reads as the plain panel title, and the content is force-shown via `min-[901px]:[&::details-content]:[content-visibility:visible]` so the wide layout is unchanged. The `<aside aria-label="Revision history">` landmark wrapper is retained so existing `getByRole("complementary")` queries (and screen readers) still resolve. Breakpoint 901px is the complement of the parent grid's `max-[900px]` stack point, so the disclosure and the stack switch together.
- **Fix 3 (Restore inside the selected row).** Each revision row is now a bordered card (`<li>`) wrapping the selection `<button>` plus, when applicable, the Restore action below a divider inside the same card. Restore renders only for `onRestore && selected && !current`, so it appears on the currently-selected past revision alone — never on the current revision, unselected rows, or a read-only viewer. Wording and the quiet `Button variant="text"` are unchanged.
- **Tokens.** No new arbitrary values: the 1040px and 900/901px breakpoints already existed in the codebase, card/divider styling reuses `border-border`/`bg-control`/`bg-control-hover`/`border-accent` and `PANEL`/`PANEL_TITLE`, and the disclosure reuses the existing details/summary chevron idiom.
- **Tests.** Added `tests/history/RevisionList.test.tsx` (summary count incl. singular/plural; Restore hidden on current-selected, hidden without `onRestore`, and shown only on the selected past row bound to its id). Updated `BoardHistory`/`NoteHistory` restore tests to select the past row before clicking Restore. Full suite: 66 files / 645 tests pass; lint, typecheck, and build clean.

### Critical Issues

_None._
