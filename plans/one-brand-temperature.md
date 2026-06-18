# One brand temperature — warm the dark theme

## Implementation Agent Instructions

- **Role**: Senior front-end/UX engineer who owns the VolleyCoach token system (`src/index.css`), the brand mark (`src/shell/BrandMark.tsx`), and the brand assets in `public/`.
- **Task**: Bring the dark theme onto the same warm brand temperature as the light theme, so the two themes read as night and day of one product. Re-hue the dark neutral chrome from cool blue-grey to warm charcoal, carry the warm brand mark onto every dark/themeless brand surface, add a theme-matched browser chrome colour, and remove the icon assets this leaves obsolete.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - This plan is the source of truth and is fully standalone: every detail you need to do the task is in this file.
    - **Do not read `plans/One brand temperature (standalone).html`.** It is a large, expensive design doc that this plan supersedes. Everything in it that still applies has already been folded into the requirements below, and parts of it are stale. Reading it only burns tokens and risks following outdated guidance.
    - Keep the change tightly scoped: colour tokens, brand assets, and the doc updates the lockstep rule requires. No layout, type, spacing, radius, or component-structure edits.
    - Keep the brand assets in lockstep per the `AGENTS.md` rule: `src/shell/BrandMark.tsx`, `public/favicon.svg`, and `docs/brand.md` stay in sync.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @docs/brand.md
    - @src/index.css
    - @src/shell/BrandMark.tsx
    - @index.html
    - @public/favicon.svg
    - @public/manifest.webmanifest
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task. Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message as `- [ ] <item>`. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Principle

A theme has two jobs: set the lightness (so the app works in a bright gym or a dark room) and carry the brand. Today the dark theme does both — it goes dark *and* swaps the warm brand temperature for a cold blue-grey, so dark mode reads as a different product. This change makes the dark theme vary lightness only and inherit the warm brand temperature from the light theme. The warm dark neutral ramp is built on one hue held at the paper's warm angle (≈74° oklch); only lightness moves down the ramp.

### The brand colour system (both themes)

This is the division of labour the whole change serves. It holds in light and dark alike:

- **Blue is the action accent, and nothing else.** Buttons, links, selected state, the avatar. It stays blue in both themes (`--accent`: `#2f6fe0` light, `#7aa2ff` dark). A cool accent on warm neutrals is the intended, deliberate pairing — blue pops harder against warm charcoal than it ever did against navy.
- **Amber/orange is the brand mark and warnings.** The mark's ball is the amber spark; warnings are amber (`--warn`). The brand mark is never the action-blue.
- **Neutrals are warm in both themes.** Warm paper in light, warm charcoal in dark. This is the one temperature.
- **Why the accent is not amber too:** amber is already the warning colour, so an amber accent would collide "do this" with "watch out" in one hue. Blue keeps the two roles unmistakably apart.

Consequence for brand surfaces: a surface that can sense the theme shows the blue mark in light and the warm mark in dark (the in-app mark and the browser-tab favicon already do this). A brand surface that *cannot* sense the theme (a baked icon, a social card) takes the warm mark, because the app defaults to dark and warm is the brand's running temperature. The only place a blue tile survives is the favicon's light branch.

### Requirement 1 — Re-hue the dark chrome tokens (`src/index.css`)

In the combined `:root, [data-theme="dark"]` block only, replace these eleven values. Author them in hex/rgba to match the block (the oklch forms below are equivalent and given for reference; the dark neutral ramp shares hue ≈74° with lightness descending).

| Token             | Current (cool)               | New (warm)                       |
|-------------------|------------------------------|----------------------------------|
| `--bg`            | `#0c0e13`                    | `#14110d` *(oklch .165 .010 74)* |
| `--bg-glow`       | `rgba(78, 104, 158, 0.16)`   | `rgba(224, 176, 116, 0.13)`      |
| `--court-surface` | `#161a22`                    | `#1f1b15` *(oklch .225 .012 74)* |
| `--court-cast`    | `rgba(0, 0, 0, 0.55)`        | `rgba(20, 12, 4, 0.6)`           |
| `--text`          | `#eef1f6`                    | `#f3efe6` *(oklch .95 .006 85)*  |
| `--text-dim`      | `#97a0b1`                    | `#a89d8c` *(oklch .71 .014 75)*  |
| `--panel`         | `rgba(255, 255, 255, 0.035)` | `rgba(255, 243, 228, 0.055)`     |
| `--border`        | `rgba(255, 255, 255, 0.09)`  | `rgba(255, 240, 222, 0.15)`      |
| `--control`       | `rgba(255, 255, 255, 0.05)`  | `rgba(255, 243, 228, 0.06)`      |
| `--control-hover` | `rgba(255, 255, 255, 0.1)`   | `rgba(255, 243, 228, 0.12)`      |
| `--accent-weak`   | `rgba(122, 162, 255, 0.16)`  | `rgba(122, 162, 255, 0.18)`      |

- Leave unchanged in that block: `--accent` `#7aa2ff`, `--on-accent` `#0b1020`, `--danger` `#ef6a52`, `--warn` `#f0a83c`.
- **Do not touch the `[data-theme="light"]` block.**
- **Do not touch the theme-invariant `:root` court block** (`--court-play`, `--court-zone`, `--court-line`, `--net`, `--court-grid`, `--ball-arrow`, `--marker-cast`, `--marker-cast-lift`, `--marker-edge`). The court floor is already a theme-invariant warm sport-floor; those surfaces are done. Do not re-add them to the dark block.
- Nothing in the app hardcodes the old cool neutrals; every surface reads these variables, so the edit re-tints the whole dark UI with no component changes.

### Requirement 2 — Theme-matched browser chrome colour (`index.html`)

Add two media-scoped `theme-color` metas to `<head>` so the browser chrome bar tracks the colour scheme:

- `(prefers-color-scheme: light)` → `#f1eee6` (the light `--bg`)
- `(prefers-color-scheme: dark)` → `#14110d` (the dark `--bg`)

### Requirement 3 — The brand mark across surfaces

Carry the warm mark onto every dark/themeless brand surface. Per surface:

- **In-app mark (`src/shell/BrandMark.tsx`) — no change.** It is monochrome line-art: the court draws in `currentColor`, the knockout ring fills with `var(--court-surface)`, and the ball is a constant amber `#e8973a`. Once Requirement 1 warms `--text` and `--court-surface`, the mark warms on its own in dark and stays correct in light. Do not add a separate tile variant.
- **Browser-tab favicon (`public/favicon.svg`) — no change.** It already carries a blue light branch and a warm-charcoal `@media (prefers-color-scheme: dark)` branch (tile `#22201c`, court/lines `#f3efe6`, ball `#e8973a`). This is the only surface that keeps a blue expression — the light branch — by design.
- **Installed-app icon (`public/apple-touch-icon.png`, `public/icons/icon-192.png`, `public/icons/icon-512.png`) — regenerate warm.** These are baked rasters that cannot swap with the theme, so they take the warm mark outright: the warm charcoal/amber colour tile, full-bleed maskable. Produce a warm maskable source SVG and export the three PNGs from it (the existing blue maskable source is `public/brand/icon-maskable.svg`; replace it with the warm one).
- **PWA manifest (`public/manifest.webmanifest`) — warm the splash.** Set `theme_color` and `background_color` to the warm dark background `#14110d` (or the warm tile `#22201c`; pick the one that reads best behind the maskable icon and note the choice), so the install splash and standalone chrome match the warm icon and the dark-default app.
- **Open Graph card (`public/og-image.png`) — regenerate warm.** The social card is a themeless brand surface, so it follows the same rule: the brand lockup on a warm field, not the blue field.

The icon geometry and the maskable safe-zone are unchanged; only the field, lines, and ball colours move to the warm expression.

### Requirement 4 — Remove the icons this leaves obsolete

Delete every icon/source file that is now unused or superseded, and reconcile the docs. Verify with a grep that nothing in app code, the build, `index.html`, or the manifest references a file before deleting it.

- Delete the standalone single-theme favicon sources superseded by `public/favicon.svg`'s two-branch file: `public/brand/favicon-blue.svg`, `public/brand/favicon-charcoal.svg`, `public/brand/favicon-min-blue.svg`, `public/brand/favicon-min-charcoal.svg`.
- Delete the blue colour-tile / OG sources once their warm replacements exist: the blue `public/brand/icon-maskable.svg` (replaced by the warm maskable source) and the blue `public/og-image.svg` (replaced by the warm OG source).
- If `public/brand/` ends up empty, remove the directory.
- Keep every wired runtime asset: `public/favicon.svg`, the regenerated `public/apple-touch-icon.png`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, the regenerated `public/og-image.png`, `public/manifest.webmanifest`, `public/_redirects`.
- Update `docs/brand.md` so it matches the result: the deleted files are gone, the installed icon and social card are the warm expression, and blue is described as the action accent and the favicon's light branch.

### Non-goals

- No layout, type, spacing, radius, or component-structure edits.
- No change to the light theme token block, the theme-invariant court tokens, the marker/role palette, or the type/shadow/radius scales.
- No change to the favicon wiring or to `BrandMark.tsx`.
- The theme-independent domain colours stay exactly as they are, even where they share a hex with the brand: the outside-hitter role `#2F6FE0` in `src/court/roles.ts` and the court volleyball `#FFC61E` in `src/court/BallArt.tsx` are player/court identity, not brand chrome. Do not "fix" them to match the warm brand.

### Testing

This is a colour-token and static-asset change with no component logic change, so no new unit tests are warranted. Confirm the existing `tests/shell/BrandMark.test.tsx` still passes (the component is untouched) and that no test references a deleted asset path.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- In dark mode the chrome — background, panels, borders, controls, dimmed text — reads warm charcoal; the blue accent and avatar stay blue; warnings stay amber. The light theme is visually unchanged.
- Contrast spot-checks clear WCAG AA: `#f3efe6` text on `#14110d` background, and `#a89d8c` dimmed text on `#1f1b15` panel. The accent `#7aa2ff` with `#0b1020` button text is unchanged and already passing.
- The in-app brand mark renders warm in dark mode (court lines in the warm text colour, warm knockout ring, amber ball) with no new component or variant; it stays correct in light.
- The browser chrome bar is warm dark under dark OS chrome and paper under light OS chrome.
- The installed-app icon, the PWA splash colours, and the OG card are the warm charcoal/amber expression. No brand surface is blue except the action accent and the favicon's light branch.
- `public/` contains only the wired icon assets listed in Requirement 4; no obsolete or superseded icon files remain; `docs/brand.md` matches the files on disk.

## Follow-ups

*None.*

## Implementation Notes

### Critical Issues

None. The change landed exactly as scoped: colour tokens, the two media-scoped `theme-color` metas, the warm brand assets, the manifest splash colours, and the lockstep doc updates. No layout, type, spacing, radius, or component-structure edits.

### What changed

- **Requirement 1 (`src/index.css`).** Re-hued the eleven dark chrome values in the combined `:root, [data-theme="dark"]` block to the warm ramp from the plan table. Left `--accent`, `--on-accent`, `--danger`, `--warn` untouched; left the `[data-theme="light"]` block and the theme-invariant `:root` court block untouched. No component reads the old cool neutrals, so the whole dark UI re-tinted with no component changes.
- **Requirement 2 (`index.html`).** Added two media-scoped `theme-color` metas after the manifest link: light `#f1eee6`, dark `#14110d`.
- **Requirement 3 (brand surfaces).**
    - `src/shell/BrandMark.tsx` and `public/favicon.svg`: unchanged, as the plan requires. The mono mark warms on its own via `currentColor` (now `--text` `#f3efe6`) and `var(--court-surface)` (now `#1f1b15`) with its constant amber ball; the favicon keeps its blue light branch and warm dark branch.
    - `public/brand/icon-maskable.svg`: replaced the blue field/lines/ball with the warm expression (tile `#22201c`, court `#f3efe6`, ball `#e8973a`), geometry and maskable safe-zone unchanged. Re-exported `public/apple-touch-icon.png` (180), `public/icons/icon-192.png`, `public/icons/icon-512.png`.
    - `public/og-image.svg`: warmed the field (`#22201c`), court (`#f3efe6`), and ball (`#e8973a`); kept the lockup, glow, and Bricolage Grotesque wordmark identical. Re-exported `public/og-image.png` (1200×630).
    - `public/manifest.webmanifest`: set `theme_color` and `background_color` to `#14110d`.
- **Requirement 4 (cleanup + docs).** Deleted the four obsolete single-theme favicon sources (`public/brand/favicon-{blue,charcoal,min-blue,min-charcoal}.svg`); `public/brand/` keeps the warm `icon-maskable.svg`, so the directory stays. Confirmed by grep that nothing in `src`, `index.html`, the manifest, or the build referenced them. Updated `docs/brand.md` to match disk: warm icon/OG/favicon-dark expression, blue described as the action accent and the favicon's light branch, deleted files removed.

### Decisions

- **Manifest splash colour: `#14110d`, not `#22201c`.** The plan allowed either. I chose the warm dark background so the manifest matches the dark `theme-color` meta and the dark-default app background; the favicon/icon tile (`#22201c`) then reads as a distinct mark on that field rather than blending into it.
- **Rasteriser: headless Chrome (`google-chrome --headless=new --screenshot`).** `rsvg-convert` and `inkscape` are absent, and ImageMagick's internal SVG renderer cannot load the OG card's Google-Fonts wordmark or reliably render gradients. Headless Chrome matches `og-image.svg`'s documented pipeline. The render script lives at `$CLAUDE_JOB_DIR/tmp/render.mjs` (outside the repo); to regenerate, point it at the two warm SVG sources. The icons (192/512/apple-touch) export at their native sizes; the OG renders at 1200×630 with the Bricolage Grotesque web font.

### Verification

- `npm run test`: 528 passed (49 files), including `tests/shell/BrandMark.test.tsx` (component untouched). No test references a deleted or changed asset path.
- `npm run format` (no changes), `npm run lint` (clean), `npm run typecheck` (clean), `npm run build` (built; `dist/` carries the warm assets and the `theme-color` metas, and none of the deleted favicon files).
- WCAG AA contrast (computed): `#f3efe6` on `#14110d` = 16.40; `#a89d8c` on `#1f1b15` = 6.42; `#a89d8c` on `#14110d` = 7.05; accent `#7aa2ff` on `#0b1020` = 7.61. All clear AA.
- Visual check of the regenerated `og-image.png` and `icon-512.png`: warm charcoal field, warm off-white court, amber ball, and the wordmark rendered in Bricolage Grotesque (not a fallback).
