# Court: theme-invariant playing surface (dark-mode fix)

Source design: `plans/plan-court-design-upgrade.html` (VolleyCoach · Spec 1 · "The court in dark mode").

## Implementation Agent Instructions

- **Role**: Frontend engineer fluent in this app's SVG court rendering and its CSS-variable theming.
- **Task**: Make the court's playing surface a fixed warm "sport-floor" that looks identical in light and dark mode, redraw the net as a flat top-down hatch, add a compact thumbnail mode, and give the ball/player movement arrows a fixed visual convention.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - One `Court` component still serves every mode — compact is a prop, never a second renderer.
    - The court reads no app theme token for anything drawn inside its frame.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @docs/architecture.md (the "court and its coordinate system" and "Motion and playback" sections)
    - @src/court/Court.tsx, @src/court/Marker.tsx, @src/court/court.css, @src/court/geometry.ts
    - @src/index.css (the `@theme` block and both `[data-theme]` token blocks)
    - @src/court/Arrows.tsx, @src/court/types.ts, @src/boards/arrows.ts
    - @src/court/RotationDiagram.tsx
    - @src/library/LibraryCard.tsx, @src/notes/BoardGroupBlock.tsx, @src/bundle/BundlePreview.tsx
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task. If you uncover unplanned work that belongs in its own future project, add it there. Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Goal and principle

The court's playing surface keeps one identity in both themes: a warm, light sport-floor with dark lines. Only the app chrome around it (page, panel, toolbar, borders, dialogs) themes light/dark. Treat the court like a Figma canvas or a Google Maps map: the work surface holds still while the UI themes around it. Today the court inverts to dark navy in dark mode, so the most important surface becomes the hardest to see; this task stops it inverting and makes both themes render the court frame identically.

### Requirements

#### R1 — Theme-invariant court surface

The floor, zones, lines, and net render with the same values in light and dark mode. Target values (oklch is the source of truth, hex the fallback; tune freely but keep the brightness relationship floor > panel > page in both themes):

- Floor — back zone: `oklch(.95 .016 84)` / `#f7f1e3`
- Floor — front zone: `oklch(.90 .030 86)` / `#ece2cc`
- Court lines (sidelines, baseline, attack line): `oklch(.30 .010 70)` / `#34302a`
- Net hatch: same as the court lines

The floor grid lines (the authoring aid) belong to this surface too: they read dark-on-light in both themes.

#### R2 — Free-zone margin around the lines

The warm floor extends a few px past the boundary lines (a real court's free zone), so the dark sidelines and baseline always have light floor on both sides and stay crisp against any panel colour. Today the floor rect stops exactly at the playing-area edge, so the outer lines sit on the chrome card; the SVG already reserves a `FREE_ZONE` margin in the `viewBox` that the floor can grow into. Markers and the boundary line keep their current positions — only the painted floor extends.

#### R3 — Net as a flat top-down hatch

Replace the current pseudo-3D net (a tape band lifted above the top line, vertical strands, and end posts) with a flat hatched band drawn from directly above, in the court-line colour, sitting on the net line like every other court line. No posts, no standing mesh — it must be spatially consistent with the bird's-eye court.

#### R4 — Markers separate from the light floor

Markers keep their incumbent identity colours and the ball keeps its art. The only marker change: give every disc a solid ring plus a soft shadow so even light-coloured discs separate cleanly from the warm floor, in both themes. (The current translucent ring is transparent in light and faint in dark; it loses definition on the new floor.)

#### R5 — In-frame surfaces follow the floor, not the theme

Everything drawn inside the court frame that currently reads a theme token must instead use the theme-invariant court palette, so it stays correct on the warm floor in both themes:

- the annotation text halo and the armed-tool-tip ring (today the chrome token `--court-surface`),
- the marker drop-shadow cast (today the theme-variant `--marker-cast` / `--marker-cast-lift`),
- the marker separator ring (today `--marker-edge`),
- the ball / movement-arrow neutral (today the theme-variant `--ball-arrow`).

The chrome token `--court-surface` itself stays theme-variant: it backs dialogs, tooltips, the sidebar, library cards, and the frame *behind* the court, none of which are inside the court frame. Do not repurpose or rename it; point the in-frame usages at the invariant palette instead.

#### R6 — Rotation diagram follows the court

The rotation diagram shares the court's surface classes, so making those invariant turns it warm/theme-invariant too. This is intended; do not decouple it. Verify it still reads correctly once the net and surface change (it borrows the net-tape and surface classes).

#### R7 — Compact (thumbnail) mode

Add a compact rendering mode to the `Court` component for small (~200px) renders. In compact mode:

- the net hatch collapses to a single line (the cross-ticks turn to noise at that size),
- marker labels are dropped,
- discs grow ~25% so the formation still reads.

The warm floor, two-tone zones, and dark lines carry down unchanged. Thread the mode through the thumbnail call sites — library cards (`LibraryCard`), note board-group thumbnails (`BoardGroupBlock`), and the bundle preview (`BundlePreview`). Full-size surfaces (board view, editor, share view, print) keep the detailed court.

#### R8 — Movement-arrow conventions

Give the derived movement arrows two fixed meanings so a ball path and a player run never get confused:

- Ball path: dashed, in the neutral colour.
- Player move: solid, in the moving player's role colour.

Players already render solid in their role colour, so the change is the ball's derived arrow becoming dashed. Carry the distinction on the `Arrow` data (set in `arrowsForStep`) and render it in `Arrows`.

### Non-goals

- Redesigning marker identity colours or the ball art (beyond the ring + shadow of R4).
- Theming the app chrome differently (page/panel/toolbar still theme normally).
- The marker-palette redesign, warm-vs-navy chrome, and other sibling tasks of this feature.
- Curving the derived movement arrows (they stay straight; see Open Issues).
- Renaming `--court-surface` or other tokens.

### Constraints

- Honour the spine decisions: normalized 0–1 coordinates, one `Court` component for all modes, SVG rendering. Compact is a prop on that one component.
- Nothing inside the court frame may read `--theme-*` (R5).
- Keep floor > panel > page brightness in both themes; court lines meet ≥ 4.5:1 contrast on the floor.

### Affected areas

For orientation only — the implementer decides the exact edits.

- `src/index.css`: make the court surface tokens (`--court-play`, `--court-zone`, `--court-line`, `--net`, `--court-grid`) theme-invariant, and give the in-frame knock-on tokens (`--marker-cast`/`--marker-cast-lift`, `--marker-edge`, `--ball-arrow`) floor-appropriate values that are identical in both themes. Leave the chrome tokens (including `--court-surface`, `--court-cast`) theme-variant.
- `src/court/court.css`: net styling; repoint the in-frame `var(--court-surface)` usages (annotation text, tool-tip ring) to the invariant floor token; solid marker ring + shadow.
- `src/court/Court.tsx`: flat-hatch net markup; grow the floor rect into the free zone; compact-mode rendering (net → single line, label suppression, disc growth).
- `src/court/Marker.tsx`: compact prop (drop label, grow disc) and the solid ring.
- `src/court/Arrows.tsx`, `src/court/types.ts`, `src/boards/arrows.ts`: dashed/neutral ball arrow vs solid/role-colour player arrow.
- `src/library/LibraryCard.tsx`, `src/notes/BoardGroupBlock.tsx`, `src/bundle/BundlePreview.tsx`: pass compact to the thumbnail `Court`.
- `src/court/RotationDiagram.tsx`: verify it still reads after the surface and net changes.

### Testing

Add or update unit tests for the behaviour that is testable through the DOM, no more than the changes require. Use the `react-testing` skill.

- Compact mode: a `Court` rendered compact shows no marker labels (the label text is absent) while a full-size `Court` still shows them.
- Movement arrows: `arrowsForStep` marks the ball's arrow as dashed/neutral and players' arrows as solid in their role colour; `Arrows` renders the ball arrow dashed.

The purely visual token/CSS changes (warm floor in both themes, free-zone margin, net hatch, ring + shadow, contrast) are verified by eye, not unit-tested.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- In dark mode, the court floor is the brightest surface on screen: floor lighter than panel, panel lighter than page.
- Light mode and dark mode render the court frame identically — same floor, lines, net, marker, and ball colours.
- Court lines are dark on the light floor and meet ≥ 4.5:1 contrast.
- The net reads as a net (flat top-down hatch in the line colour) at full size, and reduces to a single line at thumbnail size.
- Every marker, including light-coloured ones, separates clearly from the floor (solid ring + shadow).
- Library, note board-group, and bundle-preview thumbnails render in compact mode (net = single line, labels dropped, discs grown ~25%).
- The ball's movement arrow is dashed and neutral; player movement arrows are solid in their role colour.

## Follow-ups

*None.*

## Implementation Notes

The court's in-frame palette is now theme-invariant; only the chrome around it themes.

- **Invariant tokens (`src/index.css`).** The court-surface tokens (`--court-play`, `--court-zone`, `--court-line`, `--net`, `--court-grid`) and the in-frame knock-on tokens (`--marker-cast`, `--marker-cast-lift`, `--marker-edge`, `--ball-arrow`) moved into a single un-themed `:root` block and were removed from both `[data-theme]` blocks, so each is defined exactly once with no per-theme override (no specificity contest). Floor/zone/line/net/grid/ball-arrow/marker-edge use the plan's oklch values; the casts stay `drop-shadow` rgba. The chrome tokens (`--court-surface`, `--court-cast`) stay theme-variant in the theme blocks, unrenamed.
- **In-frame `--court-surface` repointed (`src/court/court.css`).** The annotation-text halo and the armed-tool-tip ring now stroke `var(--court-play)` (the invariant floor) instead of the chrome token, so they read the same on the warm floor in both themes.
- **Free-zone bleed (`src/court/Court.tsx`).** `FLOOR_BLEED = 22` SVG units grows the `court-play` and `court-zone` rects past the boundary into the viewBox's reserved free zone (the zone bleeds left/right/top only, its bottom still meeting the attack line). Markers and the boundary/attack lines keep their positions.
- **Flat net (`Court.tsx` + `court.css`).** The pseudo-3D net (lifted tape, vertical strands, posts) is replaced by a flat band sitting on the net line: a `court-net-tape` rail (restyled as the flat line) plus `court-net-hatch` cross-ticks (`±NET_BAND = 16`, drawn at full size only). The old `court-net-strand`/`court-net-post` classes are gone. `court-net-tape` stays shared with the rotation diagram.
- **Markers (`Marker.tsx`).** No structural change for the ring/shadow — the existing `court-marker-edge` ring and `court-marker-shadow` caster now read solid via the invariant `--marker-edge`/`--marker-cast`. Compact mode adds a `compact` prop: `scale = 1.25` grows every disc (and the ball art, via a `scale()` group), and the label `<text>` is suppressed.
- **Compact mode (`Court.tsx`).** A `compact` prop threads to every `Marker` and gates the net cross-ticks (compact → the single `court-net-tape` line only). Passed at the three thumbnail call sites: `LibraryCard`, `BoardGroupBlock`, `BundlePreview`. Full-size surfaces (view, editor, share, print) are untouched, so they keep the detailed court.
- **Arrow convention (`types.ts`, `boards/arrows.ts`, `Arrows.tsx`, `court.css`).** `Arrow` gains a required `dashed` field. `arrowsForStep` sets `dashed: true` for the ball (neutral colour) and `dashed: false` for players (role colour). `Arrows` adds `court-arrow-line--dashed` (a `stroke-dasharray`) to the ball's line; players stay solid.
- **Rotation diagram (`RotationDiagram.tsx`).** Followed the court automatically by sharing its classes (R6). One fix was needed: its net line sat at `NET_Y = PAD - 12` (above the floor, on the chrome) — fine when `--net` was a faint light line, but invisible once `--net` became dark. Moved to `NET_Y = PAD` so the dark net sits on the floor's top edge like the main court. No other change.
- **Tests.** Added `tests/boards/arrows.test.ts` (ball arrow dashed + neutral, player arrow solid + role colour) and two cases in `tests/court/Court.test.tsx` (compact drops labels while full size keeps them; the ball's rendered arrow line is dashed and a player's is solid). Full suite: 521 + new = all passing.
- **Verification.** Tests, ESLint, Prettier, `tsc`, and the production `vite build` all pass. The purely visual criteria (warm floor in both themes, free-zone margin, net hatch, ring + shadow, contrast, compact thumbnails) are left to eye review per the plan's Testing note — a browser check was not possible because the Playwright `browser_*` tools are not registered in this session (only the skill's guidance loads). The dev server is running at <http://localhost:5173> for that review.

### Critical Issues

None.
