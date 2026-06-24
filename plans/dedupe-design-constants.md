# De-duplicate repeated hardcoded design constants

## Implementation Agent Instructions

- **Role**: Frontend engineer fluent in the Tailwind v4 `@theme` token system, the `src/ui/styles.ts` shared class strings, and the app's CSS-variable conventions.
- **Task**: Give each repeated hardcoded design constant a single named source, following the existing `--court-size` CSS variable as the model.
- **Quality bar**:
    - Read @CLAUDE.md and @docs/style_guide.md, and follow them to the letter.
    - Make minimal changes. This is a refactor: no redesign, no re-spacing, no new dimensions beyond naming the duplicates in scope.
    - Each replaced value must resolve to the same computed value it had before, except the two deliberate micro-changes named in R1 and R3. Verify in the built CSS, not just the source.
    - Take each value from its single shared source; never leave a second inline copy behind.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md (the "No handpicked style values" rule this enforces)
    - @src/index.css (the `@theme` block; the existing `--court-size` token is the model)
    - @src/ui/styles.ts (the shared layout tokens `VIEW_BODY`, `PAGE`, and the landing `SHELL` in `src/landing/LandingPage.tsx`)
    - @src/editor/useWideEditor.ts (the JS half of the `1040px` breakpoint)
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task. Before declaring done, re-read the section and restate every item verbatim as `- [ ] <item>`. If `_None._`, write `Follow-ups: none.`

## Plan

### Goals

- Each in-scope design constant has one named definition. Changing it once changes every use.
- The codebase moves toward the style guide's "No handpicked style values" rule, which these duplicates currently violate.
- No redesign: the only visual changes are the two negligible ones named in R1 and R3, each a side effect of unifying to one source.

### Background: the duplicates

Found by auditing `src/` for repeated arbitrary values. The model already in the tree is `--court-size: min(74vh, 620px)` in `src/index.css`, referenced as `[var(--court-size)]` by every court surface. The three constants below are in scope:

- **`1040px`** — the court/editor stacking breakpoint. 11 CSS spots as `max-[1040px]` (`src/ui/styles.ts`, `src/editor/BoardView.tsx`, `src/editor/BoardEditor.tsx`, `src/landing/ShowcaseBoard.tsx`, `src/landing/RotationShowcase.tsx`) plus the JS `matchMedia("(max-width: 1040px)")` in `src/editor/useWideEditor.ts`. The two halves are coupled only by a hand-written comment, so they can drift.
- **`1320px`** — the shell/page max width. 8 spots as `max-w-[1320px]` (`src/ui/styles.ts` `PAGE`, `src/App.tsx`, `src/editor/BoardView.tsx`, `src/editor/BoardEditor.tsx`, `src/notes/NoteEditor.tsx`, `src/landing/LandingPage.tsx` `SHELL`, `src/landing/Sandbox.tsx`, `src/history/BoardHistory.tsx`).
- **Backdrop gradient** — `radial-gradient(135% 90% at 50% -10%, var(--bg-glow), transparent 55%)` over `var(--bg)`, 7 identical copies, plus 1 near-identical landing variant (`135% 85% at 50% -8%`).

### Requirements

- **R1 — `1040px` breakpoint: one CSS source, one JS source, kept in agreement.**
    - Add a named breakpoint to the `@theme` block in `src/index.css` (e.g. `--breakpoint-court: 1040px`). Replace every `max-[1040px]:` utility with the named max variant (e.g. `max-court:`).
    - Replace the `"(max-width: 1040px)"` literal in `src/editor/useWideEditor.ts` with a single TS constant for the pixel value, and compute "wide" so its boundary matches the generated CSS variant exactly. Tailwind v4's `max-<bp>` generates `@media (width < value)`, so "wide" is `min-width: value`. Add a comment in each place pointing to the other, so the coupling is explicit.
    - Accepted micro-change: the stacking boundary moves from `≤ 1040px` to `< 1040px`, a one-pixel difference at exactly 1040px. The point is that CSS and JS now share one value and one boundary instead of drifting.
    - Verify the generated media query and the JS query agree at 1040px (both treat 1040 as wide).
- **R2 — `1320px` shell width: one CSS variable.**
    - Add `--shell-max: 1320px` to the `@theme` block. Reference it as `max-w-[var(--shell-max)]` at all 8 sites, including inside the `PAGE` token (`src/ui/styles.ts`) and the `SHELL` constant (`src/landing/LandingPage.tsx`). Those tokens keep their other classes; only the literal becomes the variable.
- **R3 — Backdrop gradient: one token.**
    - Define one named token for the backdrop (a CSS custom property for the gradient, or the full background shorthand). Reference it at all 8 sites: the 7 identical app copies and the 1 landing site.
    - Accepted micro-change: the landing backdrop folds into the shared value, so its gradient shifts from `135% 85% at 50% -8%` to the shared `135% 90% at 50% -10%`. Visually negligible, and the landing is the only surface affected.

### Constraints and risks

- **Value-preserving except where named.** Every token must resolve to the identical computed value in the built CSS, except the two micro-changes in R1 and R3. Confirm with `npm run build`, then inspect `dist/assets/*.css`, the way `--court-size` was confirmed.
- **Breakpoint agreement.** The risk R1 removes is CSS and JS disagreeing at the boundary. The new code must make them agree at 1040px; verify both sides explicitly.
- **Tailwind tree-shaking.** A token referenced only through arbitrary values must still be emitted to `:root`. Confirm in the built CSS (the `--court-size` change proved this works).

### Non-goals

- No change to any value beyond the two named micro-changes. This is not a redesign or a re-spacing.
- No new tokens beyond those naming the three constants in scope.
- No move of control styling out of `src/ui/styles.ts` or restructuring of the token system.
- The Tier-2 candidates in `## Follow-ups` (the letter-spacing scale, `100dvh`) are out of scope here.

### Testing

The change is a refactor with no behavioral surface, so it adds no new tests. The existing suite must stay green, and the build output must show each token resolving to its expected value.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- No remaining inline copy of any in-scope constant: a grep for each raw literal (`1040`, `1320px`, the gradient string) returns only its single definition (plus, for `1040`, the one JS constant).
- `npm run build` succeeds and the built CSS shows each new token resolving to its expected value.
- `src/editor/useWideEditor.ts` and the CSS breakpoint agree at 1040px, verified.

## Follow-ups

- [ ] **Named letter-spacing scale.** Replace the repeated tracking literals (`0.16em`, `-0.025em`, `-0.015em`, and any others) with a named scale, in `@theme` and the `src/ui/styles.ts` tokens and components that use them.
- [ ] **Tokenize `100dvh`.** Evaluate naming the full-viewport-height value used in ~11 spots, including whether the `calc(100dvh-5rem)` and `calc(100dvh-2rem)` variants warrant their own tokens or stay inline.

## Implementation Notes

Three tokens were added to the `@theme` block in `src/index.css`, modeled on `--court-size`:

- `--breakpoint-court: 1040px` — a `--breakpoint-*` token, so Tailwind generates the `court:`/`max-court:` variants.
- `--shell-max: 1320px` — referenced as `max-w-[var(--shell-max)]`.
- `--app-backdrop: radial-gradient(135% 90% at 50% -10%, var(--bg-glow), transparent 55%), var(--bg)` — the full background shorthand, referenced as `[background:var(--app-backdrop)]`.

**R1 — `1040px`.** Replaced all 7 `max-[1040px]:` utilities with `max-court:` (`src/ui/styles.ts`, `src/editor/BoardView.tsx` ×2, `src/editor/BoardEditor.tsx` ×3 across three elements, `src/landing/ShowcaseBoard.tsx`, `src/landing/RotationShowcase.tsx`). In `src/editor/useWideEditor.ts` the `"(max-width: 1040px)"` literal became a single `COURT_BREAKPOINT_PX = 1040` constant driving a `(min-width: 1040px)` "wide" query, with coupling comments on both sides pointing at each other. Verified in the built CSS: `max-court:` emits as `@media not all and (min-width:1040px)`, which is inactive at exactly 1040px, so the layout is wide there; the JS `(min-width: 1040px)` matches at 1040px, also wide. Both agree at the boundary. This is the accepted micro-change: the boundary moved from `≤ 1040px` to `< 1040px` (one pixel at exactly 1040).

**R2 — `1320px`.** Replaced all 8 `max-w-[1320px]` sites with `max-w-[var(--shell-max)]` (`src/ui/styles.ts` `PAGE`, `src/App.tsx`, `src/editor/BoardView.tsx`, `src/editor/BoardEditor.tsx`, `src/notes/NoteEditor.tsx`, `src/landing/LandingPage.tsx` `SHELL`, `src/landing/Sandbox.tsx` `SHELL`, `src/history/BoardHistory.tsx`). Tokens kept all their other classes.

**R3 — backdrop gradient.** Replaced all 8 sites with `[background:var(--app-backdrop)]`: the 7 identical app copies (`src/App.tsx`, `src/sharing/ShareView.tsx`, `src/shell/AppShell.tsx`, `src/auth/SetPassword.tsx`, `src/account/NameSetup.tsx`, `src/sharing/GrantAccept.tsx`, `src/landing/Sandbox.tsx`) and the landing `ROOT` in `src/landing/LandingPage.tsx`. This is the accepted micro-change: the landing's `135% 85% at 50% -8%` folded into the shared `135% 90% at 50% -10%`.

**Verification.** `npm run build` succeeds; the built `:root` emits `--shell-max:1320px`, `--breakpoint-court:1040px`, and the full `--app-backdrop` value, and the usages resolve to `var(--shell-max)`/`var(--app-backdrop)` (Tailwind keeps the tree-shaken tokens because they are referenced through arbitrary values). All 629 tests pass; format, lint, and typecheck are clean. A grep for each raw literal returns only its single definition, plus, for `1040`, the one JS constant and the R1 coupling comments.

Follow-ups: none beyond the two listed below (both out of scope here).

### Critical Issues

None.
