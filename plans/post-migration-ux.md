# Post-migration UX: step strip, step transition, type scale

## Implementation Agent Instructions

- **Role**: Senior, design-minded React/TypeScript engineer fluent in Base UI (`@base-ui/react`), Tailwind v4, pointer interactions, and accessible component design.
- **Task**: Raise the UX and visual quality of three surfaces the Base UI migration left mimicking the old hand-rolled version. The goal is the best experience now, not parity with how it looked before.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Write clean, easy-to-maintain code. Keep changes scoped to the surfaces below.
    - Every interactive control keeps correct keyboard, focus, and screen-reader behaviour, and respects `prefers-reduced-motion`.
    - All control styling stays in `src/ui/` (the migration's single-source-of-truth rule). No ad-hoc per-file control styling.
    - Verify the result on screen in light and dark with the `playwright` tool, not just in tests.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @docs/architecture.md
    - @plans/base-ui-tailwind-migration.md (background: the wrapper library, token theme, and styling boundary you are building on)
    - @src/editor/StepStrip.tsx, @src/editor/BoardView.tsx, @src/ui/styles.ts, @src/index.css, and the `src/ui/` wrappers you touch
    - The `react-testing` and `frontend-design` skills.
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`. If the section is `_None._`, write `Follow-ups: none.` Do not implement follow-ups unless explicitly asked.

## Plan

### Framing

These three surfaces work and are accessible, but they were carried over from the pre-migration UI with their original look and interactions intact. This is a deliberate UX pass: improve them on their own merits.

- **This is intent, not specification.** Nothing here mandates exact sizes, radii, timings, or layouts. Where this plan describes a direction, treat it as the problem to solve, not a recipe. You understand the surfaces in more depth than this document — if you find a better approach than the one suggested, take it and say why in the Implementation Notes.
- **Do not preserve the current appearance for its own sake.** "It looked like this before" is not a reason to keep something. Visible change is expected and welcome where it improves the experience.
- **Flag what you find beyond these three.** The Base UI + Tailwind migration carried other surfaces over with their pre-migration look and interactions intact, the same way these three were. If you notice such leftovers while working — controls or layouts kept as-is for parity rather than designed — add them to `## Follow-ups` as one-line items. Do not implement them in this pass; just surface them.

### Surfaces to improve

#### 1. Step strip interactions (`src/editor/StepStrip.tsx`)

The editable step strip is the weakest interaction in the app. Reordering the current step is two single-character chevrons (`‹ ›`) sitting apart from the chips they act on, and removing a step is a small `×` glyph inside each chip.

- **Goal**: reordering should feel direct, and removing should be a clear, comfortably-sized affordance rather than a glyph.
- **Direction (not a mandate)**: dragging chips to reorder is the natural fit for a sequence; choose it or something better. Remove can be its own thing — a real control, revealed on hover/focus or always present, your call.
- **Required**: keep playback (read-only) scrubbing by clicking a step; keep the editor's add / remove / reorder operations and the "never below one step" rule; keep keyboard operability and the "current step" semantics for assistive tech. If you add dragging, it must have a keyboard-accessible equivalent.

#### 2. Step-instruction transition (`src/editor/BoardView.tsx`)

When a sequence advances, the step instruction below the description currently just fades in. It should feel like a deliberate transition between two instructions.

- **Goal**: a considered, restrained transition when the instruction changes.
- **Required**: CSS/Tailwind only — Motion stays confined to court playback and must not appear in app chrome. Honour reduced-motion. Keep it quick and non-distracting.

#### 3. Control type scale (`src/ui/styles.ts`, `src/index.css`, `src/ui/` wrappers)

Control font sizes are a pile of one-off literals (`text-[0.66rem]` through `text-[0.92rem]`, plus `text-[1.05rem]`) with no scale behind them.

- **Goal**: a small named type scale in the token theme that the controls reference, replacing the one-offs. Text shifting visibly as values land on the scale is fine and expected — that is the point.
- **Direction (not a mandate)**: pick however many steps genuinely cover the range of UI text. Aim for a real scale, not the same one-offs renamed. You may extend it to other UI text (panel titles, field labels, body) if that improves coherence.
- **Out of scope**: the fluid display-title `clamp()` and any court/SVG text. Leave those.

### What not to do

- Do not touch the `court/` rendering (SVG geometry, `Court`, `Marker`, `Arrows`, motion, roles) or its scoped CSS.
- Do not change the data model, stores, board/topic operations, playback logic, or navigation.
- Do not reintroduce Motion into app chrome.
- Do not pull in a heavy dependency (e.g. a drag-and-drop library) if pointer events handle it cleanly. If you genuinely need one, justify it in the Implementation Notes first.
- Do not expand this pass to other surfaces beyond the three above.

### Testing

Update or add tests for the changed behaviour, no more than the changes require, querying by accessible role/label/text:

- Step reorder and remove still work and keep the step count valid (never below one).
- Playback step scrubbing still works.

Use the `react-testing` skill. Leave the `court/` tests unchanged.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- The step strip's reorder and remove are deliberate, comfortably-sized, keyboard-accessible controls — not chevron glyphs and a tiny `×`.
- The step-instruction change is a considered CSS transition, reduced-motion-safe, with no Motion in app chrome.
- Controls draw their font sizes from a named type scale; the one-off `text-[…]` literals on controls are gone.
- The result is verified on screen in both light and dark themes; court rendering is unchanged.

## Follow-ups

These were parity leftovers noticed during the main pass, surfaced per the Framing. Both are now implemented (see the follow-up notes below).

- [x] Point the control text literals outside `src/ui` at the new UI type scale: the marker-palette legend name, the topic-sidebar buttons and section label, the topic-view tag pills, and the library-card eyebrow / meta / tag chips still use one-off `text-[…]` values.
- [x] Give the fixed `font-display` headings a named display scale instead of one-off `text-[…rem]` literals (alert-dialog title, library-card title, Markdown headings, and the app brand); the fluid display title stays as-is.

### Follow-up notes

Done in a later pass. Diagnostics pass (format, lint, typecheck, build), the suite stays green (136 tests), and both themes were verified on screen with Playwright. No court or behaviour change.

- **Control literals → UI scale.** Snapped every remaining control literal outside `src/ui` to the nearest existing UI scale step: the marker-palette legend name (`0.82` → `text-sm`), the topic-view subtopic pills (`0.78` → `text-sm`), the topic-sidebar nav button / topic links (`0.92` / `0.9` → `text-base`) and its "Topics" caption (`0.66` → `text-2xs`), and the library-card eyebrow / meta / tag chips (`0.66` / `0.68` → `text-2xs`). No new tokens were needed; the values land on the scale and shift a hair, as intended.
- **Display headings → named ramp.** Added a coarse three-step display ramp (`text-display-xs` 1rem / `text-display-sm` 1.125rem / `text-display-md` 1.27rem) to the `@theme` layer with companion line-heights, a ~1.125 ratio chosen so several headings share a step rather than each getting its own renamed value. Mapped the Markdown headings (h3 → xs, h2 → sm, h1 → md), the alert-dialog and library-card titles (→ sm), and the app brand (→ md). The library-card title's explicit `leading-[1.15]` was dropped so the scale owns its line-height. Left as-is per scope: the fluid display-title `clamp()` and the title-input `clamp()`.

## Implementation Notes

All three surfaces were reworked. Diagnostics pass (format, lint, typecheck, build), the suite is green (136 tests), and both themes were verified on screen with Playwright. Court rendering is untouched.

### Step strip (`src/editor/StepStrip.tsx`)

- Reorder is now direct, with no drag-and-drop dependency.
    - Pointer: a chip drags to reorder. On the first qualifying move the gesture freezes each chip's slot centre, then moves the dragged chip to the slot nearest the pointer. Because the slots are fixed for the gesture (chips swap *through* fixed positions), a fast drag crosses several at once and `moveStep(from, to)` jumps straight to the target rather than re-measuring a layout the live reorder is mutating. The dragged chip lifts (overlay cast, slight scale) and tracks the pointer; a small movement threshold separates a drag from a click, so a press still scrubs.
    - Keyboard: with a step focused, `Shift` + arrow moves it. Base UI's toolbar composite ignores arrow keys while a modifier is held, so plain arrows still roam focus and the modified-arrow reorder never fights it — no bespoke "grab mode" was needed. Chips carry `aria-keyshortcuts` and share one visible hint line. The focused chip keeps its DOM node across the reorder, so repeated presses keep working.
- Remove is now a comfortably-sized icon button that reveals on hover / focus-within, replacing the tiny `×` glyph. Its space is reserved, so revealing it never shifts the row.
- Kept intact: read-only playback scrubbing by click, `aria-current` for "the current step", the never-below-one rule, and the Toolbar's roving focus. Read-only strips carry none of the editor affordances. All chip / number / remove / drag styling lives in `src/ui/styles.ts` (`STEP_CHIP`, `STEP_CHIP_ON`, `STEP_CHIP_DRAGGING`, `STEP_NUM`, `STEP_REMOVE`).
- Known minor: a plain arrow pressed immediately after a keyboard reorder can start from a slightly stale roving index, since Base UI tracks the index and the reorder shifts it. Focus is never lost and the next reorder corrects it.

### Step-instruction transition (`src/editor/BoardView.tsx`)

- The instruction now slides in from the direction of travel as it changes, rather than a plain fade in: forward when advancing, back when stepping back. This reads as a move between two notes instead of a single element appearing.
- The direction comes from comparing the step against the previously shown one with the "adjust state during render" pattern, which avoids reading a ref during render (the `react-hooks/refs` lint forbids that).
- CSS / Tailwind only: two keyframes (`step-fwd` / `step-back`) behind named `--animate-*` tokens, with `motion-reduce:animate-none` honouring reduced motion. Motion (the library) stays confined to court playback.

### Control type scale (`src/index.css`, `src/ui/`)

- Added a six-step named scale (`text-2xs` … `text-xl`) to the `@theme` token layer with deliberate companion line-heights, and pointed every control literal in `src/ui/styles.ts` and the `src/ui` wrappers at it: buttons, icon buttons, the panel / field / eyebrow captions, swatches, overlay items, the step strip, plus Select, Input, Tabs, Combobox, Textarea, ToggleGroup, Tooltip, the dialog description, and the Markdown body. The one remaining default utility (`text-base` on the small icon glyph) moved onto the scale too, so no Tailwind-default text size is left in `src/ui`.
- Overriding the default ramp names is safe because nothing outside the controls used them. Text snapping a hair as values land on the scale is expected and is the point.
- Left as-is per scope: the fluid display-title `clamp()`, the title-input `clamp()`, the fixed `font-display` headings (a separate display ramp, see Follow-ups), and all court / SVG text.

### Verification

- 136 tests pass. Added: clicking a step scrubs straight to it in playback, and a keyboard reorder moves the active step while keeping every step. Format, lint, typecheck, and the production build are clean.
- Playwright in light and dark covered: the drag reorder (single and multi-slot, confirmed the active step moving 1 → 3 in one gesture), the reveal-on-hover remove, the reorder hint, the directional instruction transition (confirmed `step-fwd` / `step-back` apply live and flip with direction), and the rescaled controls across the editor, the read-only view, and the library. No console errors. The court is unchanged.

### Critical Issues

None. Diagnostics and the full suite pass, and both themes were verified on screen. The two Follow-ups are non-blocking parity leftovers, not defects.
