# VolleyCoach brand

The brand mark is the app's own board, cropped: a rounded tile holds the court (boundary and attack line) with the ball breaking the top-right corner, like a serve clearing the net. It is lifted straight from the SVG board a coach works on, so dropping the markers to a single ball at the net corner turns the diagram into the logo. The ball is a plain disc rather than branded artwork, which keeps the mark trademark-clean. The brand runs warm: a charcoal field, an off-white court, and an amber ball. The app defaults to dark, so warm is the brand's running temperature, and blue survives in two roles only: the in-app action accent and the favicon's light-chrome branch.

## The mark

### Colours

The mark draws from a small fixed palette, with amber hardcoded into the mark rather than read from a theme token. The brand runs warm; blue appears only in the favicon's light-chrome branch and as the in-app action accent.

| Role               | Hex       | Where                                                                              |
|--------------------|-----------|------------------------------------------------------------------------------------|
| Warm tile charcoal | `#22201c` | The warm tile's field: the installed icon, the OG card, the favicon's dark branch. |
| Warm court         | `#f3efe6` | The court and attack line on the warm tile.                                        |
| Warm amber         | `#e8973a` | The ball on the warm tile and the constant ball in the in-app mono mark.           |
| Accent / tile blue | `#2f6fe0` | The in-app action accent, and the favicon's light-chrome tile (the same blue).     |
| Court white        | `#ffffff` | The court and attack line on the favicon's blue light branch.                      |
| Tile ball amber    | `#FFC61E` | The ball on the favicon's blue light branch.                                       |

### Expressions

One mark is drawn for several jobs, and every expression keeps the same court, corner ball, and proportions. The app defaults to dark, so the brand's running temperature is warm: every themeless or baked surface takes the warm expression, and blue is left to the favicon's light-chrome branch. Each expression names the asset it ships as.

- **In-app mono mark.** The only mark used inside the product, monochrome and theme-aware, single-sourced in `src/shell/BrandMark.tsx`. The court draws in `currentColor`, so it flips with light and dark on its own. The amber ball (`#e8973a`) stays the one constant accent, kept crisp over the court corner by a hairline ring in the surface colour.
- **Favicon tile.** The theme-swapping browser-tab icon, `public/favicon.svg`. Its light-chrome branch is the blue tile with the white court and the `#FFC61E` ball; a `@media (prefers-color-scheme: dark)` branch swaps to the warm tile (charcoal field, `#f3efe6` court, `#e8973a` ball) under dark browser chrome. This is the one surface that keeps a blue expression.
- **Installed-app icon.** The warm colour tile rasterised for an installed or pinned app. It is full-bleed so each OS applies its own mask shape, with the court and ball pulled into the maskable safe zone. A baked raster cannot swap with the theme, so it takes the warm expression outright. The source `public/brand/icon-maskable.svg` exports to `public/apple-touch-icon.png` and `public/icons/icon-192.png` / `icon-512.png`, wired up by `public/manifest.webmanifest` and the `apple-touch-icon` and `manifest` links in `index.html`.
- **Open Graph card.** The brand lockup centred on the warm charcoal field, a themeless brand surface that takes the warm expression like the installed icon. The source `public/og-image.svg` exports to `public/og-image.png`.

## The lockup

`BrandLockup` pairs the mark with "VolleyCoach" set in Bricolage Grotesque, the app's display face, bold and at the tracking the UI already uses. The mark leads and the word follows as one locked unit, never re-spaced or restyled per surface.

- **Mark to wordmark.** The mark reads a touch taller than the word, about a 1.16 mark-to-text ratio.
- **Gap.** The space between mark and word is about a third of the mark's width.
- **Clear space.** Keep at least one mark-width of empty space on every side of the lockup.

## Usage and single source

`src/shell/BrandMark.tsx` is the single source for the in-product mark: every in-app surface renders `BrandMark` or `BrandLockup`, and none inlines a copy of the glyph. The static assets restate the same geometry only because they cannot import the component. A change to the mark or favicon must therefore keep `src/shell/BrandMark.tsx`, `public/favicon.svg`, and this guide in sync, as the `AGENTS.md` lockstep rule requires. Re-export the Open Graph card `public/og-image.png` from `public/og-image.svg` whenever the lockup changes, and the home-screen PNGs from `public/brand/icon-maskable.svg` whenever the tile changes.

| Surface                                 | Expression                                                 |
|-----------------------------------------|------------------------------------------------------------|
| Browser tab / favicon                   | Blue tile in light chrome, warm charcoal under dark.       |
| Sidebar (wide)                          | `BrandLockup` at the top.                                  |
| Sidebar (collapsed rail)                | `BrandMark` alone.                                         |
| Auth and onboarding gates, loading gate | `BrandLockup` above the heading.                           |
| Share view header                       | `BrandLockup`.                                             |
| Link preview (Open Graph)               | The lockup centred on the warm charcoal field.             |
| Home screen / installed app             | Warm charcoal tile, full-bleed maskable, via the manifest. |
