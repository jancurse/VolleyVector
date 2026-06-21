# VolleyCoach brand

The brand mark is the app's own board, cropped: the court (boundary and attack line) with the ball breaking the top-right corner, like a serve clearing the net. It is lifted straight from the SVG board a coach works on, so dropping the markers to a single ball at the net corner turns the diagram into the logo. The ball is a plain disc rather than branded artwork, which keeps the mark trademark-clean. The mark is pure line plus a solid ball, with no shading. The brand runs warm: a charcoal field, an off-white court, and an amber ball. The app defaults to dark, so warm is the brand's running temperature, and blue survives in one role only: the in-app action accent.

## The mark

### Colours

The mark draws from a small fixed palette: a warm amber accent and two neutrals, with amber hardcoded into the mark rather than read from a theme token. Blue appears in no icon; it survives only as the in-app action accent. The retired blue tile (`#2f6fe0`) and brighter amber (`#FFC61E`) are gone from every icon.

| Role        | Hex       | Where                                                                                 |
|-------------|-----------|---------------------------------------------------------------------------------------|
| Charcoal    | `#22201c` | A baked tile's field (installed icon, OG card); the favicon court under light chrome. |
| Off-white   | `#f3efe6` | The court and attack line on a warm tile; the favicon court under dark chrome.        |
| Amber       | `#e8973a` | The ball, on every surface.                                                           |
| Accent blue | `#2f6fe0` | The in-app action accent only; retired from every icon.                               |

### Expressions

One mark is drawn for several jobs, and every expression is the same drawing at a different scale: the same court, corner ball, and proportions. The app defaults to dark, so the brand's running temperature is warm: every baked surface takes the warm expression, and the favicon swaps with the browser chrome. Each expression names the asset it ships as.

- **In-app mono mark.** The only mark used inside the product, monochrome and theme-aware, rendered from `src/shell/BrandMark.tsx`. The court draws in `currentColor`, so it flips with light and dark on its own. The amber ball (`#e8973a`) is the one constant accent. Laid out edge-to-edge, the same footprint as the favicon.
- **Favicon.** The browser-tab icon, `public/favicon.svg`, drawn on transparency with no background and maximised so the mark touches all four edges (the browser never crops it). A `@media (prefers-color-scheme: dark)` rule swaps the court: charcoal (`#22201c`) under light chrome, off-white (`#f3efe6`) under dark. The amber ball is constant.
- **Installed-app icon.** The warm charcoal tile rasterised for an installed or pinned app. It is full-bleed so each OS applies its own mask shape, with the mark pulled into the maskable safe zone (its farthest point sits on the safe-zone radius, 40% of the icon). A baked raster cannot swap with the theme, so it takes the warm expression outright. The source `public/brand/icon-maskable.svg` rasterises to `public/apple-touch-icon.png` and `public/icons/icon-192.png` / `icon-512.png`, wired up by `public/manifest.webmanifest` and the `apple-touch-icon` and `manifest` links in `index.html`.
- **Open Graph card.** The brand lockup centred on the warm charcoal field, a themeless brand surface that takes the warm expression like the installed icon. The source `public/og-image.svg` rasterises to `public/og-image.png`.

## The lockup

`BrandLockup` pairs the mark with "VolleyCoach" set in Bricolage Grotesque, the app's display face, bold and at the tracking the UI already uses. The mark leads and the word follows as one locked unit, never re-spaced or restyled per surface.

- **Mark to wordmark.** The mark reads a touch taller than the word, about a 1.16 mark-to-text ratio.
- **Gap.** The space between mark and word is about a third of the mark's width.
- **Clear space.** Keep at least one mark-width of empty space on every side of the lockup.

## Usage and single source

`src/shell/brandMarkGeometry.ts` is the one geometry source: the canonical proportions (each a ratio of the court side) and a routine that lays the mark out for any frame. Everything derives from it, so changing a constant rescales every surface with no per-file editing.

- **In-app mark.** `src/shell/BrandMark.tsx` renders the mark live from the geometry; every in-app surface renders `BrandMark` or `BrandLockup` and none inlines a copy of the glyph.
- **Static assets are generated, never hand-edited.** `scripts/generate-brand-assets.ts` (run `npm run generate:brand`) writes `public/favicon.svg`, `public/brand/icon-maskable.svg`, and `public/og-image.svg` from the same geometry, then rasterises the PNGs with headless Chrome: the maskable tile to `public/apple-touch-icon.png` and `public/icons/icon-192.png` / `icon-512.png`, and the card to `public/og-image.png`.
- **Lockstep.** A change to the mark edits `brandMarkGeometry.ts` (or `BrandMark.tsx`), regenerates the assets, and updates this guide, keeping the geometry source, the generated assets (`public/favicon.svg`, `public/brand/icon-maskable.svg`, `public/og-image.svg`, and their PNGs), and the docs in sync as the `AGENTS.md` rule requires.

| Surface                                 | Expression                                                              |
|-----------------------------------------|-------------------------------------------------------------------------|
| Browser tab / favicon                   | Transparent mark; charcoal court in light chrome, off-white under dark. |
| Sidebar (wide)                          | `BrandLockup` at the top.                                               |
| Sidebar (collapsed rail)                | `BrandMark` alone.                                                      |
| Auth and onboarding gates, loading gate | `BrandLockup` above the heading.                                        |
| Share view header                       | `BrandLockup`.                                                          |
| Link preview (Open Graph)               | The lockup centred on the warm charcoal field.                          |
| Home screen / installed app             | Warm charcoal tile, full-bleed maskable, via the manifest.              |
