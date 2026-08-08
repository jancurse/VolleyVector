# Opponent side on the board

Issue: [#50](https://github.com/jancurse/VolleyVector/issues/50). Branch: `claude/opponent-side-board-feature-7kxmsv`.

## Context

A board today is a single half-court: our side, net at the top, marker positions normalized over that half. A coach can diagram what we do but not what the other team does, so a block, a defensive shape, or a serve-receive read against a specific opponent cannot be drawn.

This adds an opt-in opponent half. With it off (the default, and every existing board) nothing changes anywhere. With it on, the court shows both halves, markers can be placed on either side, and rotation stays a feature of our side alone.

Decisions already taken, not to be relitigated:

- Our half keeps normalized y 0 to 1 with the net at y = 0. The opponent half is y = -1 to 0. No stored board, annotation, or revision changes meaning, so there is no data migration.
- An opponent marker is a rounded square in the same role palette. Our markers stay discs. Shape carries the distinction, so it survives thumbnails, greyscale, and colour blindness.
- Opponent markers take the same roles as ours (their setter, their middle).
- The court stays portrait with the opponent half on top. When the opponent side is on the court gets its own, taller size budget and draws about a quarter smaller.
- Turning the opponent side off with opponent markers present asks for confirmation and then removes them.

## Approach

### Model

`src/court/types.ts`: `Marker` gains `side?: "opponent"`. Absent means our side, so every stored marker, bundle, and revision stays valid with no normalization. `BoardMarker` inherits it through the existing `Omit<Marker, "position">`.

`src/boards/types.ts`: `Board` gains `opponentSide: boolean`, required and defaulted like the existing `autoArrows` and `rotationStrict`. It gates both the second half of the court and the ability to hold opponent markers.

Side is marker identity, not geometry. Deriving it from `y < 0` would flip a marker's team when a player is drawn reaching over the net, and would make identity vary per step, which the model's identity-vs-position split forbids.

### Geometry (`src/court/geometry.ts`)

The mapping functions do not change. `toSvg` is affine and already handles negative input, so widening the viewBox window is the whole change and `toSvgPoint`, `fromSvgPoint`, and `clientToNormalized` keep working untouched. That keeps pointer dragging, annotation drawing, and snapping exact with no new maths.

- Add the full-court viewBox: `0 -1000 1300 2300` against today's `0 0 1300 1300`. Export it through a `courtViewBox(opponentSide)` helper plus a `viewExtent(opponentSide)` returning `{ width, height }` for callers that need the ratio.
- `clampToCourt(point, opponentSide = false)`: the y floor becomes `-1 - MARKER_REACH` when on, stays `-MARKER_REACH` when off. x is unchanged. Thread the flag through `useMarkerDrag`, the arrow-key nudge in `BoardEditor`, and the annotation writes in `operations.ts` (`shiftPoint`, `reshapeAnnotation`).
- `snapToGrid`/`snapAxis` take the y range so the grid spans both halves.
- `src/court/snapping.ts`: `SNAP_Y` gains the opponent's attack line and end line (`-ATTACK_LINE`, `-1`) when the flag is on.

### Court rendering

`src/court/Court.tsx` takes `opponentSide?: boolean`. When on it selects the full viewBox and mirrors the floor, front-zone shading, boundary, and attack line into negative y. The existing net band already sits at y = 0 and becomes the centre line with no change. The default `label` becomes "Volleyball court". `src/court/Grid.tsx` takes the same flag.

`src/court/Marker.tsx` draws an opponent player as a rounded `<rect>` of the same size in place of the disc, reusing the same fill, ring, sheen, shadow caster, edge, halo, and label. The shadow and edge shapes need a square variant, so factor the body shape into one small internal helper rather than branching in four places. The ball is never an opponent.

### Rotation (`src/boards/rotation.ts`)

One change: `rotationPlayers` filters out opponent markers, so the 5-1 preset roster, the custom assignment picker, and the diagram only ever see our players. Everything downstream already works in y 0 to 1 and needs nothing. `OFFICIAL_SPOTS`, `inPlayingArea`, `legalRegion`, and `clampToLegal` are all bounded to our half by construction.

### Board operations (`src/boards/operations.ts`)

- `benchPosition(markers, side)`: our bench stays at y = 1.07, the opponent bench mirrors to y = -1.07, and the occupancy test becomes side-aware (`y > 1` for ours, `y < -1` for theirs).
- `makeMarker`/`addMarker` take the side and stamp it on the identity. `nextLabel` numbers within a side, so both teams can carry an OH1.
- New `setOpponentSide(board, on)`: turning it on flips the flag alone, turning it off also drops every opponent marker across every step. The confirm dialog calls this.
- `stepMarkers` passes each marker's side into its bench fallback.

### Editor

- `src/editor/CourtSettings.tsx`: an "Opponent side" On/Off `ToggleGroup` beside Court mode. Off to on applies immediately. On to off routes through an `AlertDialog` (the pattern the board delete already uses) naming how many markers will go, and only when some exist.
- `src/editor/MarkerPalette.tsx`: a two-item side switch ("Our team" / "Opponent"), rendered only when the opponent side is on. The armed side decides where a pressed role lands, and its swatches switch to the square art so the palette previews what you get.
- `src/editor/MarkerInspector.tsx`: the same side switch for the selected marker, so a marker added on the wrong side is one press from fixed. It is an identity edit, so it spans every step through the existing `setMarker`.
- `framePercent` in `BoardEditor.tsx` currently divides by `VIEW_SIZE` on both axes. It takes an axis now, or the text-annotation input drifts off its shape on a full court.

### Layout

- `src/ui/CourtFrame.tsx` takes the court's aspect and swaps `aspect-square` for `aspect-[13/23]`.
- `src/index.css`: add `--court-size-full: min(86vh, 880px)` as the full court's height budget beside today's `--court-size`. Surfaces set a `--court-w` from the board (`--court-size`, or the full height times the 13/23 ratio, about 500px), and the two grid templates (`VIEW_BODY` in `src/ui/styles.ts`, and the editor grid in `BoardEditor.tsx`) read `--court-w` instead of `--court-size`.
- Thumbnails need no layout change. `.court` fills its box and SVG's default `preserveAspectRatio` letterboxes a taller viewBox inside a square, so `LibraryCard`, `BoardGroupBlock`, and `BundlePreview` keep `aspect-square` and simply draw the full court smaller and centred. Confirm this on screen rather than by reasoning.
- `src/print/BoardPrint.tsx` swaps its court box aspect the same way as `CourtFrame`.

### Persistence

New migration `supabase/migrations/<timestamp>_board_opponent_side.sql`, following `20260611181015_board_rotation_strict.sql`:

- `alter table public.boards add column opponent_side boolean not null default false;`
- `create or replace function public.commit_board(...)` adding `opponent_side = coalesce((content->>'opponent_side')::boolean, false)`. The `coalesce` is load-bearing: a browser tab open on the old bundle commits content without the key, and a bare cast would write NULL into a not-null column.
- `notify pgrst, 'reload schema';`

Client mapping in `src/supabase/rows.ts`: `BoardRow`, `BoardInsert`, `boardFromRow`, `boardToInsert`, `boardToContent`, and `boardFromRevision` (defaulting to `false` for revisions predating the column). `src/history/diff.ts` folds `opponentSide` into the existing "Settings" comparison. `tests/helpers/supabaseFake.ts` gains the column.

### Bundle and the board-creator skill

Both move together, as `AGENTS.md` requires.

- `src/bundle/types.ts`: `BundleBoard.opponentSide?: boolean`, `BundleMarker.side?: "opponent"`, `FORMAT_VERSION` 3 to 4.
- `src/bundle/parse.ts`: validate both fields, default `opponentSide` to false, and apply the existing strict-structure/lenient-content policy. A marker marked opponent, or a position at negative y, on a board that is not full court is corrected with a notice rather than a failure.
- `src/bundle/serialize.ts`: carry both.
- `.claude/skills/board-creator/`: `format.md` (the two fields and the version), `court.md` (the coordinate space now runs -1 to 1 with the opponent bench at -1.07), `scripts/validate.mjs` (validate the fields and the widened y range), and one new example bundle that uses an opponent block. `tests/bundle/examples.test.ts` already feeds every example through the real parser, so the new example is covered by construction.

### Docs

`docs/architecture.md`: the `Board`/`BoardMarker` snippets, the normalized-coordinates section, the rotation section's "our side only" rule, and the bundle format version. `AGENTS.md`'s spine bullet currently reads "Marker coordinates are normalized 0–1" and needs the opponent half's range.

## Minimality rules

This is a deliberately minimal implementation. Every item below is a constraint on the work, not advice.

- Build what this plan lists and nothing more. No refactors of code the feature only touches, no drive-by cleanups, no new abstractions introduced "while we are here".
- Comments stay at the density of the surrounding file. A new comment is justified only where the code is genuinely non-obvious, for example why `commit_board` coalesces the new column. No comment restates what a line does, and no comment records what changed.
- Docs get the smallest true edit. `docs/architecture.md` and `AGENTS.md` gain amended sentences in the sections named above, not new sections.
- Board-creator skill: update `format.md`, `court.md`, and `scripts/validate.mjs` only. Add a new example bundle only if the format change invalidates an existing one.
- Tests cover the listed behaviours once each. No parametrised sweeps over cases that share a code path.
- The `MarkerInspector` side switch is the one item that could be cut if it grows past a few lines. Everything else is load-bearing.

## Suggested order

1. Model, geometry, and `Court`/`Marker` rendering, with tests. Nothing user-reachable yet.
2. Operations, rotation filter, and the editor controls (settings toggle, palette and inspector side switch, confirm dialog).
3. Layout: `CourtFrame`, the two grids, the size token, print. Check the thumbnails on screen here.
4. Persistence: migration, `rows.ts`, diff, supabase fake.
5. Bundle, board-creator skill, docs.

`Board.opponentSide` being required will surface every literal board fixture at compile time (`src/landing/exampleBoards.ts`, test fixtures). That sweep is expected, not a sign of a missed abstraction.

## Verification

- `npm run test` for the unit suites, and the diagnostics skill for Prettier, ESLint, and `tsc`.
- New tests: `tests/court/geometry.test.ts` (clamp bounds and viewBox per flag), `tests/boards/rotation.test.ts` (opponent markers never enter a roster or an assignment), `tests/boards/operations.test.ts` (side-aware bench, labels numbered per side, turning the flag off strips opponent markers), `tests/bundle/parse.test.ts` and `serialize.test.ts` (round trip, and the correction notices), `tests/court/Court.test.tsx` (the opponent half renders and opponent markers draw square), and an editor test for the toggle and its confirm.
- `npm run test:rls` for the migration, since it replaces `commit_board`. It builds a fresh database from this branch, so it is the same check CI runs.
- `npm run dev:migrate` (not `npm run dev`: the branch carries a migration the shared local database does not have), then drive the browser per the playwright skill. This feature is geometry and layout, so a visual check earns its cost: create a board, turn the opponent side on, add markers on both sides, confirm rotation ignores them, turn it off and confirm the dialog, then look at the library thumbnail, the print route, and a mobile width.

## Independent review

After implementation and before handover, an independent subagent reviews the branch cold, with no context from the implementation session. It gets the diff, this plan, and two jobs:

1. Run `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm run test`, and report the actual output of anything that fails.
2. Judge the diff against the minimality rules above: work outside the plan's scope, comments heavier than the surrounding file, documentation beyond an amended sentence, tests that repeat a code path, and abstractions the feature does not need.

It reports findings rather than fixing them. Anything it raises is resolved before the handover file is written, so the handover describes the final state.

## Handover file

`plans/opponent-side-handover.md`, committed on the branch beside the plan and deleted with it before the squash merge. Written for the user checking the branch out locally, so it is short and ordered by what they do:

- What was built, in a few sentences: the model fields, the flag, and what changes on screen.
- Their steps, which nobody else can do. The migration is the main one: this branch adds a column and replaces `commit_board`, so the shared local database built from `main` does not have it. They run `npm run dev:migrate` (a temporary database built from this branch), not `npm run dev`. Production is untouched until the PR merges, when the CI-gated `migrate-prod.yml` pushes it. Note that the PR will carry the `database-migration` label.
- How to check it, as a click-through list: create a board, turn the opponent side on in the court settings, add markers on both sides, confirm rotation only ever sees our players, turn the opponent side off and read the confirm dialog, then look at a library thumbnail, the print route, and a narrow window.
- What to run: `npm run test`, and `npm run test:rls` for the migration (needs Docker).
- Anything knowingly left out, stated plainly.

## Notes

Per `AGENTS.md`, this plan belongs at `./plans/` on the feature branch, committed so it shows in the PR and deleted in a separate commit before the squash merge. Copy it there when implementation starts.
