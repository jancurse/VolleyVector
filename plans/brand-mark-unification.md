# Unify the brand-mark sources and simplify the favicon

## Implementation Agent Instructions

- **Role**: A senior frontend engineer with a strong eye for icon and brand-mark craft.
- **Task**: Drive every expression of the brand mark from one shared geometry source, and rebuild the favicon as a transparent, theme-aware mark.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - No hand-tuned per-surface geometry: every absolute size derives from the shared source.
    - The favicon must stay legible at real browser-tab size (16px), in both light and dark chrome.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @docs/brand.md
    - @src/shell/BrandMark.tsx
    - @public/favicon.svg
    - @public/brand/icon-maskable.svg
    - @public/og-image.svg
    - @public/manifest.webmanifest
    - @index.html
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in this file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. If you uncover unplanned work that belongs in its own future project, add it there. Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Open Issues

- Confirm the canonical proportions in [The mark](#the-mark). They round the current in-app mark's proportions into clean constants. Adjust the set if different values are wanted.

### Goals

- One mark, drawn once and reused at every size, so the favicon, the installed-app icons, the link-preview card, and the in-app mark can never drift apart again.
- A favicon that reads as a crisp mark in a browser tab, carries the warm brand theme, and swaps with light or dark browser chrome.

### Background

The brand mark currently exists as four independent drawings that have drifted apart in stroke weight, corner radius, ball size, and padding:

- `src/shell/BrandMark.tsx` draws the mark live inside the app.
- `public/favicon.svg` is the browser-tab icon.
- `public/brand/icon-maskable.svg` is exported to the installed-app PNGs (`public/apple-touch-icon.png`, `public/icons/icon-192.png`, `public/icons/icon-512.png`).
- `public/og-image.svg` is exported to the link-preview card (`public/og-image.png`).

The in-app `BrandMark` is the strongest of the four (bolder lines, rounder corners, a larger ball). Its proportions become the single canonical set.

### The mark

The mark is the board cropped to a court (boundary plus attack line) with the ball breaking the top-right corner. One canonical proportion set, every value a ratio of the court side:

| Element              | Value                                                                |
|----------------------|----------------------------------------------------------------------|
| Court border stroke  | 10% of the court side                                                |
| Attack-line stroke   | 8.5% of the court side                                               |
| Attack-line position | one third down from the court top                                    |
| Court corner radius  | 20% of the court side                                                |
| Ball radius          | 16.5% of the court side, centred on the top-right corner, drawn over |

Colours:

- Ball: one warm amber `#e8973a`, solid, on every surface.
- Court under light browser chrome: charcoal `#22201c`.
- Court under dark browser chrome: off-white `#f3efe6`.
- Retired from all icons: the old blue `#2f6fe0` and the brighter amber `#FFC61E`. Blue stays only as the in-app action accent.

No decorative shading on the icons. Drop the translucent band above the attack line and the ball's gradient sheen. The mark is pure line plus a solid ball. Shading stays only in the functional in-app court board, where it carries meaning.

### Single source

- All geometry comes from one shared, parametric source: the proportion constants above plus a geometry routine driven by the frame size and whether the surface is masked, returning the positions of the court, attack line, and ball.
- `BrandMark.tsx` renders from that source, with no geometry numbers inlined in the component.
- The static SVGs (`favicon.svg`, `icon-maskable.svg`) are generated from the same source rather than hand-drawn. The installed-app PNGs and the link-preview PNG are exported from their SVG sources.
- Changing a constant rescales every surface with no per-file editing.

### Per-surface requirements

- **Favicon** (`public/favicon.svg`):
    - No drawn background. The mark sits on transparency.
    - Theme-aware through a `prefers-color-scheme` rule: the court is charcoal under light chrome and off-white under dark chrome. The amber ball is constant.
    - Maximised so the mark's footprint fills the frame and touches all four edges, since the browser never crops it.
- **In-app mark** (`src/shell/BrandMark.tsx`): the same geometry and footprint as the favicon, with the court in `currentColor` so it follows the app theme. This is the one surface rendered live.
- **Installed-app icons** (`icon-maskable.svg` and its PNGs): keep the full-bleed warm charcoal tile, since a masked icon needs an opaque background. Size the mark so its farthest point sits on the maskable safe zone (radius 40% of the icon), the only margin the OS guarantees.
- **Link-preview card** (`og-image.svg` and `og-image.png`): the same mark, unchanged, inside the existing centred lockup with the wordmark.

### Docs and lockstep

Update `docs/brand.md` to match the new state: the favicon is transparent, warm, and theme-aware; the icons carry no shading; blue lives only as the in-app action accent. Keep `BrandMark.tsx`, `favicon.svg`, and `docs/brand.md` in lockstep per the AGENTS.md rule.

### Testing

Add a unit test for the shared geometry routine: given a frame size and surface type, it returns the expected court, attack-line, and ball positions. Keep `BrandMark` covered by a render test if it is not already. No more than the change requires. Use the react-testing skill.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the diagnostics skill to check).
- The favicon has no drawn background and swaps between charcoal and off-white with light or dark browser chrome.
- The favicon reads as a crisp mark at 16px in both light and dark tabs.
- Every icon mark is visibly the same drawing at a different scale.
- No icon carries the old blue, the brighter amber, or the shading band or ball sheen.
- Every absolute size traces back to the shared proportion constants: changing one constant rescales every surface without per-file edits.

## Follow-ups

- [ ] Filled-shape favicon variant for comparison
    - Build an alternative favicon that places the mark inside a filled shape (for example a circle, matching the installed-app icon), and compare it against the transparent version at real tab size to decide which reads better.

## Implementation Notes

### Critical Issues

- None. The plan implemented cleanly with no blocking problems.

### What was built

- **One geometry source** (`src/shell/brandMarkGeometry.ts`): the proportion constants from the plan's table (each a ratio of the court side), the fixed palette (`BRAND_COLORS`: amber, charcoal, off-white), and `brandMarkGeometry(frame, { masked })` returning the court, attack-line, and ball positions. Edge fit fills the frame so the mark touches all four edges; masked fit centres the mark and sizes it so the ball's outer edge (the mark's farthest point) lands on the maskable safe-zone radius. The farthest point is derived from the constants, not hardcoded, so changing a constant rescales every surface.
- **In-app mark** (`src/shell/BrandMark.tsx`): renders from the geometry with no inlined numbers; court in `currentColor`, constant amber ball.
- **Generator** (`scripts/generate-brand-assets.ts`, `npm run generate:brand`): writes `public/favicon.svg`, `public/brand/icon-maskable.svg`, and `public/og-image.svg` from the same geometry, then rasterises the PNGs with headless Chrome (the maskable tile to `apple-touch-icon.png` and `icons/icon-192.png`/`icon-512.png`, the card to `og-image.png`). It skips the PNGs with a notice if no Chrome binary is found (set `CHROME_BIN`).
- **Favicon**: transparent, no background, maximised to all four edges, with a `prefers-color-scheme` rule swapping the court charcoal (light) / off-white (dark); amber ball constant.
- **Removed** the translucent band, the ball gradient sheen, and the retired blue (`#2f6fe0`) / brighter amber (`#FFC61E`) from every icon. Blue remains only as the in-app action accent.
- **Tests** (`tests/shell/brandMarkGeometry.test.ts`) assert the spec (edge-touching and the safe-zone reach) rather than re-deriving the formula; the existing `BrandMark` render test still passes. Docs (`docs/brand.md`) updated to the new state.

### Decisions of note

- **Dropped the in-app knockout ring.** The old mark cut a surface-coloured ring behind the ball; a transparent favicon cannot carry one, so to keep the in-app mark and favicon the same footprint and match the plan's "pure line plus a solid ball", the ring is gone. Amber over the court corner reads crisply without it.
- **Kept the OG card's `field-glow`.** The plan scopes shading removal to the mark (the band and ball sheen) and calls the OG card layout "existing/unchanged"; the glow is card ambient, not mark shading.
- **Canonical proportions** (plan Open Issue): used the plan's table values verbatim.
- **Verification**: format/lint/typecheck/build clean; 584 tests pass; the favicon's light/dark swap and 16px legibility confirmed in a real browser (charcoal #22201c court under light, off-white #f3efe6 under dark, amber #e8973a ball in both).
