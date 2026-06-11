# Board Drawing Upgrade

## Implementation Agent Instructions

- **Role**: Senior frontend engineer with strong SVG geometry and interaction-design instincts.
- **Task**: Upgrade the board annotation feature in three stages: predictable freehand strokes and clear tool feedback, a fill style for closed shapes plus a polygon zone tool, and curved plus dashed paths.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - Implement the stages in order. After each stage the app must build, pass tests and diagnostics, and be fully usable.
    - Use the `frontend-design` skill for the visual work (tool feedback, hachure look, handle styling).
    - Existing boards must keep rendering without data migration: all model changes are read-time normalization plus optional fields.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @src/court/types.ts, @src/court/freehand.ts, @src/court/Annotations.tsx, @src/court/AnnotationHandles.tsx, @src/court/useAnnotationDraw.ts, @src/court/snapping.ts, @src/court/court.css
    - @src/boards/operations.ts (the annotation section), @src/supabase/rows.ts
    - @src/editor/AnnotationToolbar.tsx, @src/editor/AnnotationInspector.tsx, @src/editor/annotationStyle.ts, @src/editor/BoardEditor.tsx, @src/editor/useEditorShortcuts.ts
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. If you uncover unplanned work that belongs in its own future project, add it there (one feature per top-level bullet, its tasks as sub-bullets). Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`, so the user can review what you deferred. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Open Issues

- Sign-off: the dashed stroke option applies to every stroked shape (line, arrow, rect, ellipse, polygon outline), not only arrows.
- Sign-off: the polygon drawing gesture (click to add vertices, close via first vertex, double-click, or Enter; Esc cancels).
- Sign-off: toolbar labels and hotkeys (the area tool becomes "Draw ellipse" keeping hotkey O; the polygon tool takes hotkey G).

### Context

Annotations are per-step shapes on a board, stored as JSON inside each `BoardStep` and persisted verbatim through `rowToBoard`/`boardToRow` in `src/supabase/rows.ts`.
The current kinds are `line`, `arrow`, `rect`, `area` (a filled ellipse), `free` (a perfect-freehand ink stroke), and `text`, sharing a style of palette colour plus stroke width.
The editor offers one tool per kind with hotkeys, sticky tools, magnetic snapping, and select/move/reshape interactions.

### Goals

- Freehand strokes keep sharp corners and a constant width, so zigzags, triangles, and hand-drawn arrows come out as drawn.
- Fill becomes a user-controlled style (`none`, translucent tint, hand-drawn hachure) on every closed shape, ending the rect-vs-area inconsistency.
- A polygon tool marks an arbitrary zone with straight edges and the same fill options.
- Arrows can curve, and any stroked shape can be dashed, so ball paths and player movement read differently.
- The armed tool is always obvious, both in the toolbar and on the court itself.

### Non-goals

- No multi-select, rotation, z-order control, or layers.
- No fill colour separate from the stroke colour: one palette colour per shape.
- No sketchy (wobbly) outlines on shape strokes: only the hachure fill looks hand-drawn.
- Annotations stay per-step and do not interpolate during playback.

### Stage 1: Freehand fix and tool feedback

No model changes. The stored freehand `points` stay as they are; only capture tuning and rendering change.

#### Corner-preserving freehand

- Replace the variable-width ink rendering with a constant-width stroked path: `fill="none"`, `stroke=currentColor`, stroke width equal to the annotation's width, round caps and joins.
- Drop pressure simulation and heavy input smoothing. The pointer should be tracked closely, so the stored points reflect what was drawn.
- Smooth selectively when building the path: a vertex whose turn angle is gentle gets rounded (e.g. quadratic through midpoints or Catmull-Rom), while a vertex sharper than a threshold stays a hard corner. Tune the threshold so a hand-drawn circle stays smooth and a zigzag stays sharp.
- Keep the RDP simplification on commit (it preserves corners and keeps board JSON small).
- If `perfect-freehand` ends up unused, remove the dependency.
- Existing stored freehand strokes will change appearance (from tapered ink to constant-width pen). This is intended.
- The freehand hit target should follow the stroke rather than its bounding box if that is cheap (e.g. a wide transparent stroke over the same path); the current bounding-box target over-captures.

#### Active-tool feedback

- The toolbar's active tool must be unmistakable at a glance: give the active button an accent treatment instead of the current subtle background shift.
- While a drawing tool is armed, the court itself must communicate which tool is armed and the current style, for example a per-tool cursor or a small preview dot near the crosshair in the armed colour and width. The exact treatment is the implementer's design call (use the `frontend-design` skill).
- The feedback must also make the sticky-tool behaviour legible: after committing a shape it stays visible that the tool is still armed.

### Stage 2: Zones — fill style, ellipse, polygon

#### Fill as a style property

- Add a fill style `"none" | "tint" | "hachure"` to every closed shape: `rect`, `ellipse`, and the new `polygon`.
- `tint` is the current area look: the shape's colour at low opacity under its stroke.
- `hachure` is hand-rolled deterministic hatching: parallel diagonal lines in the shape's colour, clipped to the shape, plus the normal stroke. No external library, no randomness, themes via `currentColor`. Tune spacing and hatch line width so it reads at thumbnail size and on both themes.
- The new-drawing style the editor remembers (`annotationStyle`) carries the fill choice, sticky across shapes, defaulting to `tint`.
- The `AnnotationInspector` gains a fill control, shown only when it applies: a closed-shape tool is armed or a closed shape is selected.

#### Unify rect and area as rect and ellipse

- Rename the `area` kind to `ellipse`. Rect and ellipse are then the same concept with a different outline, both with the fill property.
- The toolbar tool reads "Draw ellipse" and keeps hotkey O and the Circle icon. The rect tool is unchanged.
- Legacy data normalizes at read time in a pure, tested function applied during `rowToBoard`: kind `area` becomes `ellipse` with fill `tint`; a `rect` without a fill field gets fill `none`. Boards rewrite themselves to the new shape on their next save; no migration runs.

#### Polygon tool

- New kind `polygon` with `points: NormalizedPoint[]` (3 or more vertices, implicitly closed), the shared style, and the fill property.
- Drawing gesture (new, multi-click, unlike the drag kinds): each click adds a vertex with a live rubber-band preview from the last vertex to the cursor; snapping applies per vertex; clicking the first vertex (within a tolerance), double-clicking, or pressing Enter closes the shape; Esc cancels; closing with fewer than 3 vertices discards.
- The tool is sticky like the others. Hotkey G, with a fitting Lucide icon (e.g. `Pentagon`).
- Select-tool support: hit target is the filled polygon area, translate moves all points, and reshape shows one handle per vertex.
- `translateAnnotation`, `duplicateAnnotation`, `annotationHandles`, `reshapeAnnotation`, and `copyAnnotationsToNextStep` in `src/boards/operations.ts` must handle the new kind.

### Stage 3: Paths — curved arrows and dashed strokes

#### Curved arrows

- An `arrow` gains an optional control point (`via`). Absent means straight, exactly today's rendering; present means a quadratic Bézier from `from` to `to` through the control, with the arrowhead aligned to the curve's end tangent.
- The select tool shows a third handle at the arrow's midpoint. Dragging it bends the arrow so the curve passes through the dragged point. Dragging it back close to the straight midline snaps the arrow back to straight (clears `via`).
- Endpoint reshaping and whole-shape translation move `via` consistently with the rest of the shape.
- The arrow's hit target must follow the curve (the current straight hit line would miss a bent arrow).

#### Dashed strokes

- Add a stroke style `"solid" | "dashed"` to every stroked shape: line, arrow, rect, ellipse, and polygon (not freehand, not text).
- Dash geometry scales with the stroke width, so thin and bold dashed lines both read cleanly.
- The sticky new-drawing style carries the choice, defaulting to solid. The inspector gains the control, shown only when it applies.

### Compatibility

- All persistence changes are additive optional fields plus the read-time normalization above. A board saved by the new code and opened by old code is out of scope (single-deploy web app).
- Read-only surfaces (BoardView, ShareView, library thumbnails) render every new shape and style through the shared `Annotations` layer, with no extra work beyond what the layer itself needs.

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill for frontend tests.

- Freehand path building: a sharp-angle vertex survives as a corner; a gentle curve is smoothed; simplification still bounds point counts.
- The legacy normalization function: `area` rows become tinted ellipses, fill-less rects become `none`, modern shapes pass through untouched.
- Operations: translate, duplicate, handles, and reshape for `polygon` and for arrows with `via`; midpoint drag-to-straight clearing.
- Editor interactions: the polygon click-click-close gesture (including Esc and the under-3-vertices discard), and the fill and dash inspector controls appearing only for applicable shapes.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- Each stage leaves the app fully working on its own.
- A board saved before this change renders identically in intent: former `area` shapes appear as tinted ellipses, former rects as unfilled rects.
- Drawing a zigzag freehand stroke keeps its corners; drawing a rough circle stays smooth.
- The armed tool and its style are identifiable from the toolbar and from the court without prior knowledge.

## Follow-ups

_None._

## Implementation Notes

### Critical Issues

_None so far._

### Stage 1 (done)

- **Freehand rendering** (`src/court/freehand.ts`): `perfect-freehand` is removed (also from `package.json`). `freehandPath` now emits a `d` for a constant-width stroked path: round caps and joins, `stroke=currentColor`, width from the annotation. Each interior vertex turning more than 60° stays a hard `L` corner; gentler vertices become quadratic curves through the outgoing midpoint. The 60° threshold sits well clear of both sides: an RDP-simplified hand-drawn circle turns about 20–30° per vertex, a zigzag 90° or more.
- **Capture** (`src/court/useAnnotationDraw.ts`): the pointer is tracked unsmoothed. The only filter is a `MIN_SAMPLE` floor (0.004 normalized) that drops standstill jitter, which would otherwise read as fake corners in the live preview. RDP simplification on commit is unchanged.
- **Hit target** (`src/court/Annotations.tsx`): the freehand hit target is now a wide transparent stroke over the same path with `pointer-events: stroke` (`court-annotation-hit--stroke`), replacing the over-capturing bounding box.
- **Toolbar feedback** (`src/editor/AnnotationToolbar.tsx`): the active tool takes the full accent fill (`bg-accent text-on-accent`), the app's primary-action language. The idle and active class sets are disjoint, so hover colours never compete.
- **Court feedback** (`src/court/Court.tsx`, `court.css`): while a drawing tool is armed, a small swatch (`court-tool-tip`) trails the crosshair, offset 30 SVG units to the lower right. It carries the armed colour, scales its radius with the armed width, and rings itself in the court-surface colour for contrast on both themes. It hides mid-gesture (the live draft shows the style then) and reappears after a commit, which keeps the sticky tool legible. It honours reduced motion.
- **Tests**: `tests/court/freehand.test.ts` covers the corner/smooth split with exact path strings and the simplifier's endpoint, apex, and point-count behaviour. 317 tests, diagnostics, and the production build all pass.
- **Not done**: no browser-level visual check was run; the visual changes are small and the geometry is unit-tested.

### Stage 2 (done)

- **Model** (`src/court/types.ts`): the `area` kind is gone. `rect`, the renamed `ellipse`, and the new `polygon` (3+ implicitly closed vertices) carry `fill: "none" | "tint" | "hachure"`. `NewAnnotationStyle` extends the shared style with the sticky fill, and `hasFill`/`isFillTool` narrow shapes and tools to the closed set.
- **Read-time normalization** (`src/boards/normalize.ts`, wired into `boardFromRow` in `src/supabase/rows.ts`): `area` rows load as `ellipse` with fill `tint`; a closed shape without a fill field gets `none`; modern shapes pass through. `BoardRow.steps` is typed as `StoredStep[]`, so the legacy shapes only exist at the read boundary.
- **Rendering** (`src/court/Annotations.tsx`): closed shapes render their fill from `fillAttrs` (tint is the old area look). Hachure is a `Hachure` component: deterministic 45° lines (22 SVG units apart, 3.5 wide, opacity 0.6 via `court-annotation-hachure`) covering the shape's bounding box, clipped to the shape by a `useId`-keyed `clipPath`, in `currentColor` so both themes follow. The polygon's hit target is the filled polygon area.
- **Polygon gesture** (`src/court/useAnnotationDraw.ts`): a `poly` gesture that outlives each press. Click adds a snapped vertex with a rubber-band draft; clicking the first vertex (within 0.03 normalized, once 3 exist), double-clicking (`event.detail >= 2`), or Enter closes; Esc cancels; closing under 3 vertices discards. Switching tool mid-polygon hides the draft immediately (the returned draft is derived: its kind must match the tool) and the next surface interaction discards the leftover gesture — the lint rule `react-hooks/set-state-in-effect` ruled out an effect-based reset.
- **Operations** (`src/boards/operations.ts`): `AnnotationHandle` gains `` `v${number}` ``; a polygon translates point-wise, exposes one handle per vertex, and reshapes one vertex at a time. Duplicate and copy-to-next-step needed no changes beyond translate.
- **Editor**: the toolbar reads "Draw ellipse" (O, Circle) and adds "Draw polygon" (G, Pentagon). The sticky `NewAnnotationStyle` defaults to fill `tint`. The inspector's Fill toggle (None / Tint / Hatch) appears only when a closed-shape tool is armed or a closed shape is selected.
- **Tests**: `tests/boards/normalize.test.ts` covers the legacy mapping; `tests/boards/operations.test.ts` the polygon handles, reshape, and duplicate; `tests/court/Court.test.tsx` the gesture (close via first vertex, Enter, Esc, under-3 discard) and the new shapes' rendering; `tests/editor/BoardEditor.test.tsx` the fill control's per-tool visibility. happy-dom lacks `DOMPoint.matrixTransform`, so `tests/setup.ts` shims it through `DOMMatrix.transformPoint`, which makes court pointer gestures testable. 341 tests, diagnostics, and the production build all pass.
- **Not done**: as in stage 1, no browser-level visual check (the dev server writes to the production backend); the hachure's structure is asserted in the Court test and its tuning values are noted above for review.

### Stage 3 (done)

- **Model** (`src/court/types.ts`): both changes are additive optional fields, so no new read-time normalization. An `arrow` gains `via?: NormalizedPoint` — the point the curve passes through at its midpoint, absent meaning straight. The five stroked kinds (line, arrow, rect, ellipse, polygon) gain `dash?: "solid" | "dashed"` via a shared `StrokedStyle`; absent means solid. `NewAnnotationStyle` carries the sticky dash, and `hasDash`/`isDashTool` narrow shapes and tools to the stroked set, mirroring the fill helpers.
- **Curve geometry** (`src/court/Arrows.tsx`): `curvedArrowSegment` converts the through-point to the quadratic control (`c = 2·via − (from+to)/2`), aligns the head to the end tangent (chord fallback when the control degenerates onto the tip), and de-Casteljau-trims the drawn path by ~`HEAD_LEN` of approximate arc so the round cap never pokes past the tip. The straight head construction is shared via the extracted `headPath`.
- **Rendering** (`src/court/Annotations.tsx`): a bent arrow draws the trimmed quadratic plus the head; the hit target follows the same curve as a wide stroke-only path (`court-annotation-hit--stroke`), since the straight hit line would miss the bow. `dashAttrs` emits `strokeDasharray` scaled to the stroke width (dash 2.4×, gap 2.2× — the round caps swallow half a width at each dash end) on every stroked shape.
- **Operations** (`src/boards/operations.ts`): `AnnotationHandle` gains `mid`, shown at `via` (or the straight midpoint). Dragging it bends the arrow through the dragged point, and dropping it within 0.02 normalized of the from–to segment clears `via`. Endpoint reshaping carries `via` along by half the delta, so the bend keeps its shape relative to the moving chord; translate (and so duplicate and copy-to-next-step) shifts `via` with the endpoints.
- **Editor**: the sticky `NewAnnotationStyle` defaults to dash `solid`; the inspector gains a Stroke toggle (Solid / Dashed) shown only when a stroked tool is armed or a stroked shape is selected, above the Fill control. The mid handle takes the move cursor (`court.css`).
- **Tests**: `tests/boards/operations.test.ts` covers the mid handle's position and bend, the drag-to-straight clearing, the half-delta endpoint carry, and via under translate/duplicate; `tests/court/Court.test.tsx` renders a dashed line and a bent dashed arrow (asserting the scaled dasharray and the quadratic path) and the arrow's three handles; `tests/editor/BoardEditor.test.tsx` covers the stroke control's per-tool visibility. 351 tests, diagnostics, and the production build all pass.
- **Not done**: as in the earlier stages, no browser-level visual check; the curve and dash geometry are unit-tested and their tuning values noted above.

### Polygon finish refinement (post-verification feedback)

- **Close on the last vertex too** (`src/court/useAnnotationDraw.ts`): once 3 vertices exist, a click within `CLOSE_RADIUS` of the first _or_ last vertex closes the shape. This replaces the `event.detail >= 2` double-click check, which Firefox never satisfies (it reports `detail` 0 on pointer events): a double-click's second press lands on the vertex its first press placed, so it closes through the last-vertex rule on every browser and on touch.
- **Visible finish cues** (`src/court/Court.tsx`, `court.css`): while a polygon is in progress the first and last placed vertex carry an accent-ringed dot (`court-poly-target`, the reshape handles' visual language); in closing range the dot grows, fills with the accent, and glows (`--hot`), so "click here to finish" is visible. The hook exposes these as `closeTargets`.
- **Hint line** (`src/editor/BoardEditor.tsx`): while the polygon tool is armed, a dim line under the court spells out the finish gestures (first/last corner, double-click, Enter; Esc cancels) — a hover tooltip would never surface on touch.
- **Tests**: close-via-last-vertex, the dots' presence and hot state, and the hint's per-tool visibility. 355 tests, diagnostics, and the build pass.
