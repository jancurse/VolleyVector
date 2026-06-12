# Rotation Feature UX Improvements

## Implementation Agent Instructions

- **Role**: Senior React + TypeScript frontend engineer with volleyball coaching domain knowledge and a careful eye for visual consistency.
- **Task**: Improve the rotation feature's UX in three ways: consistent side-rail panel order with a capped description, a readable purpose-built rotation diagram, and a tap-a-player overlap-relationship cue on the main court in the read-only view.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - Stay inside the app's visual language: the fixed role/colour palette, the `court-` CSS conventions, the shared UI wrappers, and the theme tokens.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @src/boards/rotation.ts
    - @src/editor/RotationPanel.tsx
    - @src/editor/RotationBoard.tsx
    - @src/editor/BoardView.tsx
    - @src/editor/BoardEditor.tsx
    - @src/court/Court.tsx
    - @src/court/court.css
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. If you uncover unplanned work that belongs in its own future project, add it there (one feature per top-level bullet, its tasks as sub-bullets). Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`, so the user can review what you deferred. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Goals

- The rotation card sits in the same place in the board view and the board editor, and stays visible beside the court regardless of how long the board's texts grow.
- The rotation diagram is readable at its panel size: player labels and official position numbers legible at a glance.
- A player watching a board can see why they stand where: which neighbours constrain them and the area those neighbours leave them.

### Non-goals

- No change to rotation legality logic, enforcement modes, or the stored board model.
- No change to editor-side rotation interaction beyond panel placement (strict clamping and violation flags stay as they are).
- No directional glyphs (chevrons/arrows) on the constraint ties: the shaded legal region already carries the direction.

### Requirements

#### 1. Panel order and description height

- The right rail orders its panels Rotation → Description → Step instruction on **both** surfaces. The view already has this order; the editor currently has the rotation panel last and must move it to the top of the aside.
- In a **Sequence** view, the description panel caps its height (around 15rem) and scrolls internally, so the rotation card and step instruction stay beside the court however long the description grows.
- In a **Position** view, the description stays unbounded (nothing sits below it).
- Step instructions are never capped: they grow freely.

#### 2. Readable rotation diagram

- Replace the rotation board's reuse of the full `Court` component with a purpose-built diagram. Keep a recognisable half-court silhouette (boundary, a net hint at the top edge, the attack line) so its orientation maps onto the main court; drop the free-zone margin and other detail that wastes its small width.
- Player discs render roughly three times their current on-screen size, reusing the fixed role/colour palette and the existing label conventions, so labels are comfortably readable at the panel's ~250–300px width. The six official spots are far enough apart that enlarged discs never collide.
- Each official position shows its number (1–6): a small quiet numeral by an occupied spot; an empty spot (custom mode) keeps the dashed-outline-with-numeral language that exists today, scaled to the new size.
- Custom-mode behaviour is unchanged: unassigned players wait on a bench row below the court, dragging one onto a spot assigns it (displacing any occupant), dragging it away benches it. Preset mode stays a read-only preview.
- Respect module layering: a component rendered from `src/court/` styles through `court.css` and must not import from `src/boards/`; keep the model mapping in the editor-side adapter so `RotationPanel` and the view's rotation card keep their current call sites.

#### 3. "Who do I key off" cue on the main court (view only)

- In the read-only board view, while the shown step's rotation is active, tapping an assigned player on the main court shows their overlap relationships:
    - Their constraining neighbours (the front/back counterpart and the adjacent in-row players, per the existing pairwise relations in `src/boards/rotation.ts`) stay prominent; all other markers dim.
    - A tie is drawn from the player to each constraining neighbour, in the accent language (clearly distinct from the warning ties of a violation).
    - The player's legal region is shaded: the rectangle bounded by those neighbours' current positions and the playing area. Derive it from the existing `clampToLegal` logic by extracting a shared helper, not by duplicating the bounds maths.
- Tapping the court surface clears the cue; tapping an unassigned marker (ball, coach, extra players) does nothing. The selected player keeps the standard selection halo.
- The cue works for Positions and Sequences, and during playback it follows the shown step (an assignment that no longer includes the player simply shows nothing).
- The rotation card in the view carries one short muted hint telling viewers the court is tappable.
- The board editor's marker interaction is untouched.

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill for frontend tests.

- The extracted legal-region helper and the constraining-neighbour derivation, alongside the existing `clampToLegal` suite in `tests/boards/rotation.test.ts`.
- The view's tap cue: tapping an assigned player shows the region and ties, tapping the surface clears them, unassigned markers are inert.
- The new diagram: a preset renders six labelled discs with numerals 1–6; custom mode renders empty spots and assigns by drag.
- The editor's reordered aside and the sequence-only description cap.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- No browser use in this task. In the final report, ask the user to judge on screen what only eyes can: the rotation diagram's readability and composition, the tap cue's look on both themes, and the custom-mode drag feel.

## Follow-ups

_None._

## Implementation Notes

### What changed

- **Panel order and description height.**
    - `BoardEditor` moved `RotationPanel` to the top of its aside, so both surfaces now read Rotation → Description → Step instruction.
    - `BoardView`'s `DescriptionPanel` gained a `capped` prop: the Sequence branch passes it and the body wraps in `max-h-60 overflow-y-auto` (15rem, internal scroll). The Position branch stays unbounded, and step instructions are untouched.
- **Readable rotation diagram** (reworked after review: the first pass was an oversized half-court replica).
    - `src/court/RotationDiagram.tsx` draws a square 3×2 grid of the six official zones instead of a miniature court: front row 4-3-2 along a net-tape hint, back row 5-6-1 below, the front row shaded like the main court's front zone, hairline dividers between zones, and a quiet numeral in each zone's corner.
    - Discs render at the court's own `PLAYER_RADIUS` in a 596-unit-wide view, so at the panel's 260px they sit slightly smaller on screen than the main court's markers and share its exact look (palette, sheen, label conventions, `markerName`).
    - An empty zone marks the drop destination with a dashed disc-sized `.court-spot` outline at its centre; the corner numeral identifies the zone either way.
    - Custom mode: a bench row below the grid while players wait unassigned (a fully assigned card stays as compact as a preset one), dropping a disc inside a zone assigns it, dropping outside benches it. Dropping on an occupied zone swaps the two players when the dragged one came from a zone, and benches the occupant when it came from the bench (`placeRotationMarker`). Preset mode renders read-only with no bench band.
    - `RotationBoard.tsx` is the board-model adapter (slots → spots, bench, index → slot), so `RotationPanel` and the view's rotation card kept their call sites; the panel now sizes both modes at one 260px width so the discs match across preset and custom.
- **Tap cue in the view** (reworked after review: the region wash buried the signal).
    - The cue is now only the relationships: a solid accent tie from the tapped player to each constraining neighbour, with every uninvolved marker dimmed — the mini diagram's connections pulled onto the court. The legal-region wash is gone from `CourtCue`, `Court`, and `court.css`.
    - The cue shows on both surfaces and is tappable from both: `RotationDiagram` takes `cue`/`onSelect` in view mode (ties between the involved zone centres, halo on the tapped disc, uninvolved discs dimmed), and `RotationBoard`/`RotationViewPanel` pass the view's one cue state through.
    - `boards/rotation.ts` keeps `legalRegion` (strict-mode clamping still clamps to it) and `constrainingNeighbours` derives the partner ids from the same `Y_PAIRS`/`X_PAIRS`.
    - `Court` keeps the select-only mode (`onSelect` without `onMove`: tappable markers, pointer cursor via `.court--tap`, no dragging); `Marker` keeps the `dimmed` prop (`.court-marker--dim`).
    - `BoardView` holds the tapped id, builds the cue from the shown step's neighbours (an assignment that drops the player shows nothing), passes `selectedId` for the standard halo, and only wires `onSelect` while the rotation is active.
    - The planned tap hint on the rotation card was cut in review: the sentence read as chat copy, not product UI, so the cue stays discoverable by touch alone.

### Critical Issues

None known. Two small behaviours to be aware of:

- During playback the cue's ties snap to the incoming step's stored positions while the discs are still gliding there.
- The share view renders through `BoardView`, so share-link visitors get the tap cue too. That reads as intended for a read-only view.

### Verification

- 424 tests pass (covering the helper suites, the tap cue, the diagram preset/custom drag, the aside order, the description cap; the diagram and cue tests updated for the rework).
- Prettier, ESLint, and `tsc --noEmit` are all clean.
- Not verified on screen: the plan forbids browser use, so the zone grid's composition, the cue on both themes, and the drag feel need an eyeball pass.
