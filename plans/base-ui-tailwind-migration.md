# Base UI + Tailwind Migration

## Implementation Agent Instructions

- **Role**: Senior React/TypeScript engineer fluent in Base UI (`@base-ui/react`), Tailwind v4, and accessible component design.
- **Task**: Migrate VolleyCoach's UI from hand-rolled components + a single global plain-CSS file to Base UI primitives styled with Tailwind v4, driven by one token theme and a thin set of shared wrapper components.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature. Do not rewrite modules that are out of scope (see Non-goals).
    - Write clean, easy-to-maintain code.
    - Every interactive overlay must have correct keyboard, focus, escape/outside-click, and screen-reader behavior, and must respect `prefers-reduced-motion`.
    - Preserve the existing visual identity (fonts, role/marker colours, court look) in both light and dark themes. Verify on screen with the `playwright` tool, not just in tests.
    - One source of truth per control: all buttons, inputs, and overlays render through the shared wrappers. No ad-hoc per-file control styling outside `src/ui/`.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @docs/architecture.md
    - @src/index.css (the current token + class system)
    - The components being migrated: @src/App.tsx, @src/ui/DebugMenu.tsx, @src/ui/ThemeToggle.tsx, @src/topics/TopicPicker.tsx, @src/topics/TopicSidebar.tsx, @src/editor/TagEditor.tsx, @src/editor/DescriptionEditor.tsx, @src/editor/StepStrip.tsx, @src/editor/MarkerInspector.tsx, @src/editor/MarkerPalette.tsx, @src/editor/BoardView.tsx, @src/library/BoardGrid.tsx
    - Base UI component docs (fetch current docs via the Context7 MCP tool before using each primitive).
    - The `react-testing` and `frontend-design` skills.
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`. If the section is `_None._`, write `Follow-ups: none.` Do not implement follow-ups unless explicitly asked.

## Plan

### Goals

- Replace hand-rolled and native overlay controls with Base UI primitives so keyboard, focus management, escape/outside-click dismissal, collision-aware positioning, touch, and screen-reader semantics are correct by construction.
- Style everything through Tailwind v4 utilities backed by one token theme. Add the spacing, radius, and shadow scales the current CSS lacks.
- Establish a single source of truth: a small set of styled wrapper components in `src/ui/`, used everywhere, so every button and control is identical because it has one definition.
- Add tooltips to the icon-only controls.

### Non-goals

- Do not rewrite the `court/` rendering module (SVG geometry, `Court`, `Marker`, `Arrows`, `useMarkerDrag`, `roles`, `motion`). Its approach stays. Its visual styling stays as scoped raw CSS.
- Do not change the data model, stores, operations, playback logic, or navigation behavior.
- Do not change Motion's role in court playback. Motion stays for marker glide and entrance; reduced-motion handling stays.

### Token theme

- Move the design tokens into a Tailwind v4 `@theme` so utilities resolve to them. Keep the existing semantic names where they read well.
    - Keep: the three font families, `--ease-settle`, and the full light/dark colour sets (`--bg`, `--court-*`, `--text`, `--text-dim`, `--panel`, `--border`, `--control`, `--control-hover`, `--accent`, `--accent-weak`, `--on-accent`, `--danger`, marker/cast shadows).
    - Add a **spacing scale**, **radius scale** (replace the scattered `7/8/9/10/11/12/18/999px` with named steps incl. a pill), and a **shadow scale** (name the recurring overlay shadow `0 18px 40px -22px var(--court-cast)` once, plus the marker shadow).
- **Theming stays attribute-driven.** Tokens swap on `[data-theme="light"]` / `[data-theme="dark"]` as today. Prefer semantic colour utilities whose CSS variable swaps with the theme over duplicating every rule with a `dark:` variant. Keep the pre-paint theme script in `index.html`.

### Styling boundary

- **Tailwind** for all app chrome: layout, typography, spacing, the library, editor, topics, sidebar, header, transport chrome, and every wrapper component.
- **Raw CSS (scoped)** only for the artful court internals: the SVG court surface, zones, boundary, attack line, woven net, markers, and arrows. Move these out of the global file into a court-scoped stylesheet so the global sheet can be retired.
- Retire the global `vc-*` BEM stylesheet entirely once migration completes, except the court-scoped CSS.

### Component mapping

| Current                                                               | Base UI primitive              | Shared wrapper                 | Notes                                                                                                                                                                             |
|-----------------------------------------------------------------------|--------------------------------|--------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `DebugMenu` dropdown                                                  | Menu                           | `Menu`                         | Items become real menu items; full keyboard + dismissal.                                                                                                                          |
| `ThemeToggle`                                                         | (button) + Tooltip             | `IconButton` + `Tooltip`       | Icon-only; gains a tooltip.                                                                                                                                                       |
| `TopicPicker` native `<select>`                                       | Select                         | `Select`                       | Styled trigger + listbox; render the tree depth as real indentation, not leading spaces.                                                                                          |
| `TagEditor` autocomplete                                              | Combobox (multiple, creatable) | `Combobox`                     | Commit a new free-form tag immediately on Enter when no exact match (no confirm dialog); accept suggestions by click/keyboard; keep comma/blur commit and Backspace-removes-last. |
| `DescriptionEditor` Write/Preview                                     | Tabs                           | `Tabs`                         | Tab + tabpanel for the two modes.                                                                                                                                                 |
| `BoardGrid` type filter                                               | ToggleGroup (single)           | `ToggleGroup`                  | All / Positions / Sequences.                                                                                                                                                      |
| `BoardGrid` tag filter pills                                          | ToggleGroup (multiple)         | `ToggleGroup`                  | Intersection filter; multi-select.                                                                                                                                                |
| positions/basic mode switch                                           | ToggleGroup (single)           | `ToggleGroup`                  |                                                                                                                                                                                   |
| `MarkerInspector` role picker                                         | RadioGroup                     | `SwatchGroup`                  | Exactly one role; styled as swatches.                                                                                                                                             |
| `MarkerInspector` colour picker                                       | RadioGroup                     | `SwatchGroup`                  | Basic mode only, non-ball.                                                                                                                                                        |
| `TopicSidebar` disclosure tree                                        | Collapsible (per node)         | `Collapsible`                  | Expand/collapse with correct `aria-expanded`.                                                                                                                                     |
| `App` `window.confirm` (delete board, delete topic)                   | AlertDialog                    | `AlertDialog` + `useConfirm`   | Replace both native confirms.                                                                                                                                                     |
| `StepStrip`, transport controls                                       | Toolbar                        | `Toolbar`                      | Roving arrow-key focus across the controls.                                                                                                                                       |
| All buttons (`vc-primary`, `vc-text-button`, `vc-back`, icon buttons) | (button)                       | `Button` / `IconButton`        | Variants: primary, text, ghost, danger; sizes.                                                                                                                                    |
| Text inputs, title input, textarea                                    | Field + Input                  | `Field` / `Input` / `Textarea` | Labels wired through Field.                                                                                                                                                       |

- **Tooltips** go on every icon-only / glyph-only control: theme toggle, debug toggle, transport (play/pause/next/prev), step move arrows, step remove, and the sidebar reorder arrows. Wrap once via a single `TooltipProvider` near the app root.
- The wrapper components listed above live in `src/ui/`, one per file, and are the only place control styling is defined.

### Migration phases

Keep the app building and the suite green at the end of each phase.

1. **Scaffold.** Install Base UI and Tailwind v4 (`@tailwindcss/vite`). Wire the Vite plugin. Introduce the `@theme` token layer and the court-scoped CSS alongside the existing global sheet, with no visual change.
2. **Wrappers.** Build the `src/ui/` wrapper library on Base UI + tokens (`Button`, `IconButton`, `Field`/`Input`/`Textarea`, `Tooltip`+provider, `Menu`, `Select`, `Combobox`, `Tabs`, `ToggleGroup`, `SwatchGroup`, `Collapsible`, `Dialog`/`AlertDialog`+`useConfirm`, `Toolbar`).
3. **Adopt.** Replace the controls area by area per the mapping table, swapping each call site to a wrapper and deleting the corresponding hand-rolled component/markup. Add the tooltips.
4. **Sweep.** Replace remaining ad-hoc buttons/inputs and layout/typography classes with wrappers and Tailwind utilities. Delete dead `vc-*` rules, leaving only the court-scoped CSS.

### Overlay motion

- Use Base UI's built-in enter/exit state for overlay transitions (menus, select, combobox popup, dialogs, tooltips), styled with Tailwind. Keep these restrained and on the shared `--ease-settle`. Do not introduce Motion into overlays. Honour reduced-motion.

### Risks

- **Test environment.** Base UI uses portals and browser APIs (e.g. ResizeObserver, pointer/animation, `scrollIntoView`) that happy-dom may not fully implement. Add the minimal polyfills/stubs to `tests/setup.ts` as needed.
- **TopicPicker semantics change.** Moving off the native `<select>` removes the OS mobile picker. Accepted. Verify touch behaviour of the Select on a small viewport with `playwright`.
- **Creatable combobox.** Follow Base UI's official creatable Combobox pattern (`multiple`, controlled `inputValue`/`value`), committing new tags immediately without the demo's confirmation dialog. This is the most intricate control; build and test it carefully.

### Testing

Test the behavior the app needs, not the current implementation. Rewrite or replace existing tests where Base UI changes the correct accessible semantics (menu items, listbox, dialog, tabs, radios). Query by role/accessible-name per the testing rules. Cover, at minimum:

- Menu (debug actions) opens, is keyboard-navigable, and dismisses on escape/outside-click.
- Delete board and delete topic go through the confirm dialog (confirm proceeds, cancel aborts).
- TopicPicker Select files a board / nests a topic by choosing an option.
- TagEditor commits a new free-form tag and accepts an existing suggestion.
- Write/Preview switches and renders markdown; type and tag filters narrow the grid; mode switch swaps the palette; role/colour pickers change a marker.
- Use the `react-testing` skill. Keep `court/` tests as they are.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- No `window.confirm`/`window.alert` remain; destructive actions use the dialog.
- Every overlay works by keyboard (focus trap + return on dialogs, roving focus on menus/toolbars, type-ahead where applicable), dismisses on escape and outside-click, and respects reduced-motion.
- Visual parity with the current design in both light and dark themes, verified with `playwright` screenshots; court rendering is unchanged.
- Control styling exists only in `src/ui/` wrappers; no `vc-*` classes remain except the court-scoped CSS.

## Follow-ups

Quality cleanups deferred only to hold visual/behavioural parity with the pre-migration baseline. None affect correctness; each is the cleaner choice on its own merits. All six are now implemented (see the implementation note below).

- [x] Style the `DescriptionEditor` Write/Preview tabs with Base UI's `Tabs.Indicator` (a sliding underline) instead of the `data-[selected]` background swap that mimics the old segmented control.
- [x] Drop Motion from the `BoardView` step-instruction crossfade and use a CSS/Tailwind transition, so Motion stays confined to court playback rather than appearing in app chrome.
- [x] Snap controls to the named radius / size / spacing scale instead of arbitrary pixel literals (`size-[40px]`, `rounded-[11px]`, `rounded-[14px]`, ad-hoc `clamp()`/rem values), accepting invisible sub-pixel shifts for fewer one-off values.
- [x] Rebuild the step strip and the marker-palette legend on the shared wrapper vocabulary (e.g. `ToggleGroup` / `Toolbar` patterns) rather than the current bespoke inline-styled composites.
- [x] Rename the `court/` module's `vc-*` classes to a non-`vc` scoped convention for consistency. This touches the court non-goal, so it is deliberately separate.
- [x] Split vendors with `build.rollupOptions.output.manualChunks` (react, base-ui, motion, react-markdown) so they cache independently and the main chunk drops back under Vite's 500 kB warning. The bundle is ~600 kB JS today after adding Base UI.

### Follow-up implementation

Done in the four-phase migration's wake. Diagnostics (format, lint, typecheck) pass, the suite is green (134 tests), and parity was re-checked on screen in light and dark. Notable decisions:

- **Tabs.Indicator.** `src/ui/Tabs.tsx` is now an underline tabset: the list is a `relative` flex row with a bottom border, and a `Tabs.Indicator` slides under the active tab via its `--active-tab-left` / `--active-tab-width` variables (`transition-[left,width]`, reduced-motion honoured). Tabs lost the segmented box and the `data-[selected]` background; only the text colour and the indicator mark the selection.
- **Crossfade.** `BoardView` drops `AnimatePresence`/`motion.div` for a keyed `<div>` running a new `step-in` keyframe (`animate-step-in motion-reduce:animate-none`). `MotionConfig` stays — it still governs the court's marker glide. Motion no longer appears in app chrome.
- **Scale.** Snapped the control **size, radius, and spacing** literals (px and rem) to the named scales in the `src/ui` wrappers and the two domain composites: icon buttons (`size-10`/`size-13`/`size-7.5`, `rounded-lg`/`rounded-xl`), swatches, inputs/textarea/select/combobox/toggle/tab paddings, the disclosure caret, and the sidebar spacer. Tailwind v4 generates the decimal steps (`size-7.5`, `px-4.5`, …) on demand. Left intentionally untouched: the **fluid layout clamps** (page gaps, the display `TITLE` font) and **min/max content constraints** (`min-w`/`max-h`), since snapping those to fixed steps would change responsive behaviour, not just shift a sub-pixel.
- **Shared vocabulary.** Control styling for the step strip and palette now lives in `src/ui/styles.ts` (`SWATCH_BASE`, `LEGEND_BUTTON`, `STEP_CHIP`/`STEP_CHIP_ON`/`STEP_NUM`/`STEP_REMOVE`), not inline in `editor/`. `SwatchGroup` and the palette share one swatch; "+ Step" uses `buttonClass("dashed", …)`; the move arrows and transport stay shared icon buttons. The step scrubber stays a `Toolbar` carrying `aria-current` (the correct semantic for "current step") rather than a `ToggleGroup` with `aria-pressed`.
- **Court rename.** The `court/` classes moved from `vc-*` to a `court-` scoped convention (block `court`, e.g. `court-marker`, `court-arrow`, keyframes `court-pop`/`court-fade`) across `court.css` and `Court`/`Marker`/`Arrows`. No `vc-*` class names remain anywhere.
- **Vendor chunks.** `vite.config.ts` adds a `manualChunks` function splitting react, base-ui, motion, and react-markdown (its whole remark/micromark subtree) into separate chunks. The app chunk is now ~58 kB and no chunk trips the 500 kB warning.

## Implementation Notes

The migration ran in the four planned phases. The app builds, all diagnostics pass, and the suite is green (134 tests). Visual parity in light and dark was checked on screen with Playwright; court rendering is untouched.

### Package choice

The plan named `@base-ui-components/react`, whose only published version (`1.0.0-rc.0`) is **deprecated** — npm's own install warning points to the renamed, stable successor `@base-ui/react`. We build on `@base-ui/react@1.5.0` (same maintainers, same import structure, stable release) and corrected the package name in the plan header. Tailwind is `tailwindcss@4` with `@tailwindcss/vite`.

### Token theme and styling boundary

- `src/index.css` is the Tailwind entry. Static tokens (the three fonts, `--ease-settle`, a radius scale incl. a pill, a shadow scale, and a `rise` animation) live in `@theme`. The theme-swapping colours live in `@theme inline` mapping each colour utility (`bg-panel`, `text-text-dim`, `border-border`, …) onto a runtime CSS variable; the `:root` / `[data-theme]` blocks redefine those variables, so utilities follow the light/dark switch with no `dark:` variants. The pre-paint theme script in `index.html` is unchanged.
- The artful court internals moved verbatim to `src/court/court.css` (scoped raw CSS): surface, zones, boundary, attack line, woven net, markers, halo, arrows, and their keyframes. The global `vc-*` BEM sheet was retired entirely. The only remaining `vc-*` names are the court classes the `court/` module renders.

### Wrappers (`src/ui/`)

One file per wrapper, all control styling centralised in `src/ui/styles.ts`: `Button`, `IconButton`, `Field`/`Input`/`Textarea`, `Tooltip` (+ `TooltipProvider`), `Menu`, `Select`, `Combobox`, `Tabs`, `ToggleGroup`, `SwatchGroup`, `Collapsible`, `AlertDialog` (+ `useConfirm`), `Toolbar`, plus `Markdown` and `CourtFrame` helpers. Notable decisions:

- **Tooltips** compose by wrapping a Base UI trigger: `IconButton` adds its own tooltip when standalone, and passes `tooltip={null}` when it is itself a Menu/Toolbar trigger so the outer wrapper owns the tooltip (avoids two components fighting for the same element/ref).
- **`useConfirm`** resolves its promise directly in the confirm/cancel handlers. Base UI only fires `onOpenChange` for component-initiated closes, not for a controlled `open` flip, so an earlier "resolve in onOpenChange after setOpen(false)" approach hung — fixed.
- **`Combobox`** follows Base UI's creatable pattern but commits immediately (no confirmation dialog): Enter/comma/blur commit the typed tag, suggestions are accepted by click/keyboard, Backspace removes the last chip, duplicates are ignored case-insensitively. `filter={null}` with pre-filtered string items keeps the "Add …" row predictable; blur-commit is deferred a tick so selecting a suggestion never also adds the typed text.
- **`ToggleGroup`** takes a discriminated single/multiple prop; single mode ignores deselecting the active item so one stays pressed (type filter, mode switch).
- **`Markdown`** replaces `.vc-markdown` by mapping each element to Tailwind utilities (with explicit `list-disc`/`list-decimal` since preflight strips list markers).
- Two domain composites — the marker palette legend buttons and the step chips — keep their bespoke Tailwind in their own components rather than forcing the generic Button vocabulary; the reusable button/input/overlay vocabulary itself lives only in `src/ui/`.

### Tests

Rewrote the eight App tests whose accessible semantics changed: menu items (`menuitem`), role/colour pickers (`radio`/`radiogroup`/`checked`), Write/Preview (`tab`), the topic `Select` (open trigger → click `option` instead of `selectOptions`), and both destructive actions (through the `alertdialog` instead of a stubbed `window.confirm`). Added a menu keyboard-nav/escape test and a delete-cancel test. `tests/setup.ts` gained minimal happy-dom stubs (`ResizeObserver`, `scrollIntoView`, pointer-capture) for Base UI's overlays. Court tests are unchanged.

### Critical Issues

None. No blocking issues remain: diagnostics and the full suite pass, and both themes were verified on screen. The two items above are non-blocking follow-ups.
