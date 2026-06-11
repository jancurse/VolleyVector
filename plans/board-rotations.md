# Board Rotations

## Implementation Agent Instructions

- **Role**: Senior frontend engineer on VolleyCoach, fluent in the board model and the court's normalized-coordinate system.
- **Task**: Add a rotation mode to boards (issue #14): a per-step rotation with an always-visible rotation board, and overlap-rule checking in strict and loose flavours.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - Keep all rotation legality logic as pure functions in `src/boards/`, separate from rendering and dragging.
    - Use the `frontend-design` skill for the new UI surfaces.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @docs/architecture.md
    - `src/boards/types.ts`, `src/boards/operations.ts`
    - `src/court/geometry.ts`, `src/court/useMarkerDrag.ts`
    - `src/editor/BoardEditor.tsx`
    - `src/ui/ToggleGroup.tsx`, `src/ui/CourtFrame.tsx`

- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. If you uncover unplanned work that belongs in its own future project, add it there (one feature per top-level bullet, its tasks as sub-bullets). Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`, so the user can review what you deferred. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Open Issues

_None — pending final confirmation._

### Concepts

- **Actual board**: the existing court diagram — where the players actually stand. The term distinguishes it from the rotation board; nothing about it changes.
- **Rotation board**: a second, small court diagram showing the six players on their official positions for the active rotation. The six spots are fixed canonical points (front row 4-3-2, back row 5-6-1 per FIVB Rule 7.4.1).
- **Rotation**: a per-step setting, one of: off, **Rotation 1–6** (a 5-1 preset), or **Custom** (the coach assigns the six official positions manually, supporting any six players and systems like 6-2 or 4-2).
- **Rotation N (5-1 preset)**: the standard 5-1 service order S → OH1 → MB1 → OPP → OH2 → MB2, with the setter at official position N and each next player in service order at the next position (wrapping after 6). Which middle is "MB1" is label order only; any other arrangement is Custom's job.
- **Official position (1–6)**: a single player's place in the rotational order, the FIVB rulebook term. Overlap legality is defined over official positions, never over roles.
- **Strict / loose**: the two enforcement flavours. Strict prevents illegal arrangements; loose permits them but flags them.

### Requirements

- Rotation is set per step. A step with rotation off looks and behaves exactly as today.
- Turning rotation on requires six players for the official positions; until then it is blocked, not auto-fixed. Markers without an official position (ball, coach, extras) are never constrained.
- The Rotation 1–6 presets are enabled only when the on-court roster matches a 5-1: exactly one setter, two outsides, one opposite, and either two middles or one middle plus one libero. Any other six players disable the presets with a short hint; Custom remains available.
- With a libero in a preset, the libero takes the back-row middle position and the middle the front-row one, re-derived per rotation (the two middle slots are always one front-row, one back-row). There is no libero setting.
- In Custom, the libero is assigned freely, but a libero on a front-row official position is illegal: loose flags it with the warning halo on the libero alone plus label text ("illegal libero position"); strict refuses the assignment.
- Switching to Custom seeds from the assignment currently shown (e.g. the active preset), so it edits rather than starts over; only a step with no prior assignment starts from scratch. Selecting a preset while Custom is active overwrites the custom assignment.
- Custom from scratch shows the six players benched beside the rotation board and the six official spots drawn empty; the coach places each player onto a spot. Rotation is not active (no label, no legality checks on the actual board) until all six are placed.
- While rotation is on, two things are always visible:
    - A text label: "Rotation 3" / "Custom rotation".
    - The rotation board, rendered beside the actual board.
- In Custom rotation, the rotation board is the assignment surface: the coach places players onto the six official spots there. With a 1–6 preset it is a read-only preview.
- Overlap legality is a pure function of the official positions and the actual positions.
- Enforcement (strict/loose) is one per-board setting, shown with the rotation UI whenever any step has rotation on. It defaults to loose.
- **Strict** is loose plus clamping: it shows the same violation flags (a step can become illegal without a drag, e.g. by switching presets over inherited positions) and additionally clamps dragging on the actual board at the legal boundary.
- **Loose** allows any arrangement and visually flags violations. A violation is always a broken pairwise relation, never a single player (except the libero and on-court rules below): each violated pair is flagged as a pair, and the rotation label additionally reads "positional fault" while any violation exists.

### Legality rules

The reference is FIVB Rule 7.4 (Official Volleyball Rules 2025–2028), restated for marker points:

- All comparisons are between marker centre coordinates, and ties are legal (the rulebook's "level with or" — strict-mode clamping parks markers exactly on the boundary, which must be legal).
- Seven pairwise checks, by official position:
    - Front/back on y: each back-row player not nearer the net than their front-row counterpart — pairs {1,2}, {6,3}, {5,4}.
    - Side-by-side on x, adjacent within each row only: {4,3}, {3,2} (front) and {5,6}, {6,1} (back). Outer pairs ({4,2}, {5,1}) are implied by transitivity over points and are not checked or flagged separately.
- All six assigned players are constrained; there is no serving-team or server exemption (a board shows one team with no concept of who serves; an author who does not want checks leaves rotation off).
- Each of the six assigned players must be within the playing area; an assigned player outside it is a single-marker violation (solo warning halo plus label text), and strict clamps the six to the playing area.

### Sequences and playback

- Each step carries its own rotation (off, preset, or custom assignment); a sequence can walk through rotations step by step.
- Inserting a step clones the rotation along with the positions, like `insertStep` clones positions today.
- During playback the rotation board and label follow the active step, crossfading like the per-step instruction. Steps with rotation off show neither.
- Derived movement arrows are unaffected by rotation.
- Violation flags show in the read-only view and during playback too, not only in the editor (an illegal arrangement may be deliberately authored to teach positional faults).

### Design decisions

- The rotation board reuses the existing `Court` component read-only at thumbnail size (the library-card treatment), with the same marker discs, labels, and colours as the actual board, so a reader maps players between the two by identity.
- The rotation board and its label are visible whenever rotation is on, in both the editor and the read-only view. No hover or click reveal: hover does not exist on touch. On wide screens it sits beside the actual board; on narrow screens below it, collapsible, with the label always visible.
- The rotation selector is the existing segmented `ToggleGroup` (`src/ui/ToggleGroup.tsx`) with items 1–6 and Custom, shown only in the editor. Exact placement of the selector, enforcement setting, and rotation board within the editor is the implementer's call, following the existing editor layout language; no pixel placement is prescribed here.
- Loose-mode flagging draws the broken relation: a thin warning-coloured tie between the two markers of each violated pair, plus a warning halo on both markers (the selection halo's grammar in a theme warning token, so it reads as state, not identity). A marker in several bad relations gets several ties. No legal-region overlays or corrective arrows: strict mode is the flavour where the rules push back.
- No new visual vocabulary: all controls render through the `src/ui` wrappers and existing tokens, and the rotation board frame follows `CourtFrame`'s surface language at reduced scale.

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill for frontend tests.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- With a rotation active in strict mode, no drag can produce an illegal arrangement.
- With a rotation active in loose mode, every illegal arrangement is visibly flagged.
- Markers without an official position are never constrained or flagged.
- The active rotation is identifiable in both editor and view without any interaction (label + rotation board).

## Follow-ups

_None._

## Implementation Notes

### Critical Issues

- **The migration must be pushed before this branch deploys.** The client now reads and writes `boards.rotation_strict`. Until `20260611181015_board_rotation_strict.sql` is applied, every board save fails with a missing-column error. The migration is written, linked, and dry-run verified; the push awaits your confirmation (production rule).

### What was built

- **Model and logic** (`src/boards/`): `BoardStep.rotation` (a `StepRotation`: a 5-1 preset or a custom slot→marker assignment) and `Board.rotationStrict` in `types.ts`. All rotation logic is pure in `rotation.ts`: the official spots, 5-1 preset derivation with the per-rotation libero swap, assignment resolution, the seven pairwise overlap checks plus the playing-area and libero checks, strict-mode clamping, and the step transforms (`setStepRotation`, `placeRotationMarker`). `insertStep` clones the rotation alongside positions.
- **Court rendering** (`src/court/`): a `warnings` prop on `Court` draws a dashed warning tie per broken pair and a warning halo (`court-halo--warn`, new `--warn` theme token) on each flagged marker. A `spots` prop draws the empty official-position outlines on the rotation board.
- **UI** (`src/editor/`): `RotationPanel` (selector Off/1–6/Custom with disabled-state hints, the per-board Loose/Strict toggle, the label with fault text, and the rotation board) sits in the editor aside. `RotationBoard` reuses `Court` read-only at small scale; in custom mode it is the assignment surface with a bench and drag-to-spot placement. `BoardView` shows a collapsible rotation panel (label always visible) that follows the active step during playback, and violation flags render on the read-only court too. `ToggleGroup` items gained an optional `disabled` flag.
- **Persistence**: rotations ride in the existing steps jsonb; `rotation_strict` is a new boolean column (migration above) mapped in `supabase/rows.ts`.
- **Tests**: `tests/boards/rotation.test.ts` covers preset derivation, the libero swap, roster rejection, assignment resolution, all violation kinds, ties-are-legal, strict clamping, flag mapping, and the step transforms. All 403 tests, lint, typecheck, and the production build pass.

### Decisions of note

- Eligible players for the six positions are all roles except ball and coach; the 5-1 presets additionally require the roster to be exactly one setter, two outsides, one opposite, and two middles or a middle plus libero (label order decides OH1/MB1).
- A preset whose roster later stops matching (e.g. the setter is removed) goes inactive rather than erroring: no label in the view, an explanatory hint in the editor.
- Strict-mode refusal of a libero on a front-row spot is enforced in the editor's place handler; the drag simply snaps back.
- Visual check (Playwright) passed with a clean console. One observation: the pressed segment of the shared segmented toggle is low-contrast, an existing trait of that control, left untouched.
