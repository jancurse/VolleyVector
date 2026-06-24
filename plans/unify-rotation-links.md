# Unify the rotation player links

## Implementation Agent Instructions

- **Role**: Frontend engineer fluent in this app's SVG court, the rotation model, and its theming tokens.
- **Task**: Replace the two separate rotation-link systems (the selection cue and the violation flags) with one link model over the pairwise constraint edges, where a violated edge is persistent red and a selected player's edges are blue.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - One rendering path for the links on each surface. A violation must not be a separate implementation from the cue: it is the same edge in a different state.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - `src/boards/rotation.ts` (the constraint edges, `constrainingNeighbours`, `rotationViolations`, `violationFlags`)
    - `src/court/Court.tsx` (the current `cue` and `warnings` props), `src/court/Marker.tsx`, `src/court/court.css`
    - `src/court/RotationDiagram.tsx`, `src/editor/RotationBoard.tsx`, `src/editor/RotationPanel.tsx`
    - `src/editor/BoardView.tsx`, `src/editor/BoardEditor.tsx`
    - `src/index.css` (theme tokens)
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. If you uncover unplanned work that belongs in its own future project, add it there. Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Goal

There is currently one rotation feature drawn two unrelated ways:

- a blue selection cue (`constrainingNeighbours` → `CourtCue`, `.court-cue-tie`, accent), and
- a violation system (`rotationViolations`/`violationFlags` → `CourtWarnings`, `.court-tie` + `.court-halo--warn`, the `--warn` amber).

Both draw the same thing: lines along the pairwise overlap relations between assigned players. Collapse them into one link model so a violation is just an edge in a different colour, not a second implementation.

### The link model

The links are the pairwise constraint edges between the six assigned players (the `Y_PAIRS` and `X_PAIRS` relations resolved through the step's rotation assignment). Each rendered edge is in one of two states:

- **Violation** — the pair currently breaks its overlap relation. Drawn in the new `--danger` colour, **dashed**, and **persistent**: it shows whenever the violation exists, with nothing selected.
- **Cue** — an edge incident to the currently selected player that is *not* violated. Drawn in the accent **blue**, **solid**, and only while that player is selected.

A selected player in a violated pair therefore shows that pair's edge red and its remaining (legal) edges blue.

This replaces the separate `cue` and `warnings` inputs to `Court` (and the diagram) with a single set of links, each carrying its state. `CourtCue` and `CourtWarnings` collapse accordingly.

### Halos and dimming

- **No halo on a pair violation.** The red edge carries it.
- **`--danger` halo for the two solo violations** that have no edge: a player outside the playing area (`outside`) and a libero on a front-row slot (`libero`).
- **Selection halo stays accent blue** even when the selected player is in a violation.
- **Dimming is selection-only.** Uninvolved markers step back only while a player is selected (the blue spotlight). At rest, with only persistent red edges showing, nothing dims.

### The `--danger` token

- Add a `--danger` theme token (light and dark values) in `src/index.css`, a true red that reads as alert, alongside `--color-danger` for Tailwind use.
- The rotation fault edge, the solo-violation halo, and the fault-message text (`RotationPanel` / `BoardView`, currently `text-warn`) use `--danger`.
- `--warn` is consumed only by the rotation feature today. After this change nothing should use it for rotation; remove `--warn` if it has no remaining consumer, or leave it untouched if cleaner.

### Per-surface behaviour

| Surface                                            | Today                           | After                                                                          |
|----------------------------------------------------|---------------------------------|--------------------------------------------------------------------------------|
| Court — view (`BoardView`)                         | blue cue on tap; amber warnings | blue cue on tap; red persistent edges; danger halo for solo violations only    |
| Court — editor (`BoardEditor`)                     | amber warnings only             | red persistent edges; **add** blue cue on marker selection, live during a drag |
| Rotation diagram — view card (`RotationViewPanel`) | blue cue only                   | blue cue; **add** red persistent edges                                         |
| Rotation diagram — editor card (`RotationPanel`)   | no links                        | **add** red persistent edges; **add** blue cue mirrored from court selection   |

The blue cue in the editor is driven by the existing marker selection (which already opens the inspector and is the drag target), and the edges recompute live as an assigned player is dragged. Selecting a player lights its blue edges on both the editor court and the editor rotation diagram, as the view already does.

### Constraints

- Keep the colour-blind-safe redundant encoding: blue is solid, red is dashed, so the two states differ by line style as well as colour (also survives the grayscale print surface).
- Pure rotation logic stays in `src/boards/rotation.ts`; rendering stays in `src/court/`. No DOM or colour concerns leak into the model.
- All values from shared tokens (`src/index.css`, `src/ui/styles.ts`); no hand-picked colours.

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill for frontend tests.

- The edge state derivation: a violated pair yields a violation edge regardless of selection; selecting a player yields blue edges to its legal constraining neighbours; a selected player in a violation shows the violated edge red and its other edges blue.
- Solo violations (`outside`, `libero`) yield a danger halo and no edge.
- No dimming without a selection.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- A violation shows in red without any selection, on both the court and the rotation diagram, in both view and editor.
- Selecting an assigned player shows its legal constraint edges in blue, on both the court and the rotation diagram, in both view and editor, updating live during a drag.
- A pair violation draws no halo; only `outside` and `libero` violations draw a `--danger` halo.
- The fault message reads in `--danger`.

## Follow-ups

*None.*

## Implementation Notes

The two rotation-link systems are now one link model derived in `src/boards/rotation.ts` and rendered through one path on each surface.

### The model (`src/boards/rotation.ts`)

- `violationFlags` is gone. Two pure functions replace it:
    - `rotationLinks(assignment, violations, selectedId): RotationOverlay` returns `{ links, faultIds }`. Each broken pair is a persistent `{ a, b, state: "violation" }` edge; the two solo violations (`outside`, `libero`) carry no edge and surface in `faultIds`. With a player selected, each still-legal constraining neighbour gains a `{ state: "cue" }` edge, while a neighbour it already overlaps stays its violation edge (so a selected player in a violated pair shows that edge red and its others blue).
    - `spotlightMarkers(links, selectedId): Set<string> | null` is the dimming set (the selected player plus the markers it links to), or null with nothing selected or a marker that has no edges — so nothing dims at rest, on either surface.
- New exported types `RotationLink` and `RotationOverlay`. `constrainingNeighbours` stays, now consumed by `rotationLinks` rather than the view.

### The `--danger` token

- `--danger` (and its `--color-danger` Tailwind mapping) **already existed** in `src/index.css` as the destructive-action red (`#d6442b` light / `#ef6a52` dark). It reads as a true alert red, so the plan's "add a `--danger` token" was already satisfied; I reused it rather than add a near-duplicate. The fault edge, the solo-fault halo, and the fault message all key off it.
- `--warn` and `--color-warn` had no consumer left after the change, so both are removed.

### Rendering

- `Court` drops the `warnings`/`cue` props (and the `CourtWarnings`/`CourtCue` types) for one `rotation?: RotationOverlay` prop plus the existing `selectedId`. One block renders every link as `court-link court-link--{state}`; markers take `fault` (danger halo) and `dimmed` (from `spotlightMarkers`).
- `court.css`: `.court-tie` + `.court-cue-tie` collapse into `.court-link` with `--cue` (solid accent) and `--violation` (dashed danger) modifiers, keeping the colour-blind-/print-safe solid-vs-dashed split. `.court-halo--warn` becomes `.court-halo--fault` in `--danger`. `Marker`'s `warning` prop is renamed `fault`.
- `RotationDiagram` / `RotationBoard` / `RotationPanel` swap `cue` for `links` + `selectedId`; the diagram draws the same links between zone centres. Per the per-surface table the diagram shows edges and the selection halo, but not the solo-fault halos (those are court-only — the diagram has no "outside the area").

### Wiring

- `BoardView`: the tap state is gated to `selectedId` (null once the shown step's assignment no longer holds the tapped player), so playback to a step without that player clears the highlight. The overlay drives both the court and the rotation card.
- `BoardEditor`: the overlay is computed from the editor's existing marker `selectedId`, so selecting a player lights its cue edges and dims the rest on both the court and the rotation card, and everything recomputes live during a drag (violations follow the dragged step's positions). Persistent violation edges show whenever a rotation is active.

### Verification

- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, and `npm run test` (606 tests) all pass.
- Tests: the `violationFlags` test is replaced by `rotationLinks` and `spotlightMarkers` tests covering the edge-state derivation, the solo-fault halos, and no-dimming-without-selection; the `BoardView` test now seeds a legal placement and asserts the new classes, plus a new test that a violation draws a persistent red edge on both surfaces with nothing selected or dimmed.

### Critical Issues

None. One behavioural change worth flagging for review: dimming (the blue selection spotlight) now applies in the **editor** when an assigned player is selected under an active rotation, matching the view. This follows the plan's "Dimming is selection-only" rule and the per-surface table; if it proves distracting while authoring, it can be gated to the view alone, but the plan asked for parity.
