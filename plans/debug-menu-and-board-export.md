# Debug Menu (dev-only) & Board JSON Export

## Implementation Agent Instructions

- **Role**: React + TypeScript engineer working in the VolleyCoach client.
- **Task**: Add a dev-only debug menu in the header with localStorage-clearing actions, and an "export JSON to clipboard" button on the board view.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - Match the existing header/button component patterns (see `ThemeToggle.tsx`) and CSS class conventions (`vc-*`).
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @src/App.tsx
    - @src/ui/ThemeToggle.tsx
    - @src/boards/storage.ts
    - @src/topics/storage.ts
    - @src/theme/useTheme.ts
    - @src/editor/BoardView.tsx
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`. If the section is `_None._`, write `Follow-ups: none.` Do not implement follow-ups unless explicitly asked.

## Plan

### Debug menu

A dev-only control in the header for wiping persisted state during development.

- **Visibility**: rendered only when `import.meta.env.DEV` is true, so it never ships in a production build.
- **Placement**: a button in the header, beside the `ThemeToggle`. Clicking it opens a small menu/panel listing the actions. Follow the existing header/button styling (`vc-*` classes, icon-button pattern from `ThemeToggle`).
- **Actions** (each runs, then reloads the page via `window.location.reload()` so the app re-reads storage):
    - **Clear all boards** — remove the boards localStorage key (`volleycoach-boards`).
    - **Clear all topics** — remove the topics localStorage key (`volleycoach-topics`).
    - **Clear all local storage** — `localStorage.clear()`.
- **End state after reload**: clearing the boards or topics key causes the app to reseed its samples (`SAMPLE_BOARDS` / `SAMPLE_TOPICS`) on next load — i.e. these actions reset that data to the first-run sample state, not to empty. "Clear all local storage" likewise reseeds boards and topics and resets the theme to its default. This reset-to-samples behavior is intended.
- The localStorage key strings are currently private to `boards/storage.ts`, `topics/storage.ts`, and `theme/useTheme.ts`. The debug menu needs to clear them; decide whether to export the existing constants or expose small clear helpers from those modules rather than duplicating the key strings in the debug component.

### Board JSON export

A button on the read-only board view that copies the board's JSON to the clipboard.

- **Location**: `BoardView` (`src/editor/BoardView.tsx`), in the view bar near the existing "Edit" button.
- **Scope**: shown for **any** board in view mode (both Positions and Sequences), not only Sequences.
- **Behavior**: copies the board object as formatted JSON (`JSON.stringify(board, null, 2)`) to the clipboard via `navigator.clipboard.writeText`.
- **Feedback**: give the user a brief confirmation that the copy succeeded (e.g. the button label switches to a "Copied" state momentarily). Handle the clipboard call failing without crashing the view.
- This button is part of the normal app (not gated behind dev mode and not part of the debug menu).

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill for frontend tests.

- The export button copies the board's JSON to the clipboard (mock the clipboard API) and surfaces its confirmation state.
- The debug menu's visibility gating and its clear actions are reasonable to cover if they can be tested without brittleness; the dev-only gate and `window.location.reload` are environment/browser APIs and may be mocked or left out if testing them adds more complexity than value — note what was skipped.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- The debug button appears in `npm run dev` and is absent from a production build (`npm run build`).
- Each debug action clears the expected storage and the page reloads to the reseeded/reset state.
- The export button appears for every board in view mode and copies valid JSON to the clipboard with visible confirmation.

## Follow-ups

_None._

## Implementation Notes

### What changed

- **Storage clear helpers** — added `clearBoards()` to [src/boards/storage.ts](../src/boards/storage.ts) and `clearTopics()` to [src/topics/storage.ts](../src/topics/storage.ts), each a one-liner over the module-private `STORAGE_KEY`. Chose small clear helpers over exporting the key constants so the key strings stay private to their modules and are never duplicated in the debug component. The theme key needs no helper — "Clear all local storage" uses `localStorage.clear()` directly.
- **DebugMenu** — new component [src/ui/DebugMenu.tsx](../src/ui/DebugMenu.tsx): an icon button (bug glyph) that toggles a small dropdown of the three actions. Each action clears its storage then `window.location.reload()`s. It reuses the `ThemeToggle` icon-button look (the `.vc-theme-toggle` rule now also targets `.vc-debug-toggle`) and the tag-autocomplete dropdown look for the panel.
- **Dev-only gate** — rendered as `{import.meta.env.DEV && <DebugMenu />}` in [src/App.tsx](../src/App.tsx), inside a new `.vc-header-actions` flex wrapper so it sits beside the `ThemeToggle` without breaking the header's `space-between`. Vite replaces `import.meta.env.DEV` with `false` in a production build, so Rollup dead-code-eliminates the branch and tree-shakes the whole component out of the JS bundle (verified: none of the action labels or the `Debug menu` aria-label appear in `dist/assets/*.js`).
- **vite-env.d.ts** — added [src/vite-env.d.ts](../src/vite-env.d.ts) with `/// <reference types="vite/client" />` so `import.meta.env.DEV` type-checks. This file was already anticipated by `vite.config.ts` (listed in the coverage `exclude`).
- **Board JSON export** — in [src/editor/BoardView.tsx](../src/editor/BoardView.tsx), a `Copy JSON` button (secondary `vc-new` style) sits beside `Edit` in the view bar, inside a new `.vc-view-actions` wrapper. The view bar is outside the Position/Sequence branch, so the button shows for **both** kinds. It writes `JSON.stringify(board, null, 2)` via `navigator.clipboard.writeText`, flips the label to `Copied` on success (auto-reset after 1.5s via a cleaned-up `useEffect` timeout), and swallows a rejected clipboard call in a `catch` so the view never crashes.

### Testing approach

- **Export** (App test, parametrized over a Position and a Sequence): mocks `navigator.clipboard.writeText`, asserts the copied string parses to JSON matching the board, and asserts the `Copied` confirmation appears. The mock is installed **after** `renderApp()` because `userEvent.setup()` installs its own clipboard stub that would otherwise overwrite it.
- **Debug menu** (App test): asserts the dev-only button opens the panel and offers all three actions.
- **Clear helpers** (storage unit tests): `clearBoards`/`clearTopics` drop their key so the next load returns `null` (reseeds).
- **Deliberately skipped** — (1) the actual `window.location.reload()` wiring per action, and (2) the production-build absence of the button. Both are environment/browser concerns: `reload` would need a brittle `window.location` mock for little value, and `import.meta.env.DEV` is statically `true` under Vitest so the gate cannot be flipped in a unit test. Production absence was instead verified directly by grepping the `npm run build` JS bundle.

### Critical Issues

- **Inert debug CSS ships in production.** The `.vc-debug*` rules remain in the built stylesheet (CSS is not class-tree-shaken). This is harmless — no element ever carries those classes in production since the component is gone from the JS — but the bytes are present. Left as-is to keep the styling in one place with the rest of the header CSS.
