# VolleyCoach brand

The brand mark is the app's own board, cropped: a rounded tile holds the white court (boundary and attack line) with the ball breaking the top-right corner, like a serve clearing the net. It is lifted straight from the SVG board a coach works on, so dropping the markers to a single ball at the net corner turns the diagram into the logo. The ball is a plain disc rather than branded artwork, which keeps the mark trademark-clean. Blue ships as the default, alongside a warm charcoal-and-amber alternate.

## The mark

### Colours

The mark draws from a small fixed palette, with amber hardcoded into the mark rather than read from a theme token.

| Role                | Hex       | Where                                                        |
|---------------------|-----------|--------------------------------------------------------------|
| Tile blue           | `#2f6fe0` | The colour tile's field (the same blue as the light accent). |
| Court white         | `#ffffff` | The court and attack line on the blue tile.                  |
| Tile ball amber     | `#FFC61E` | The ball on the colour tile.                                 |
| In-app / warm amber | `#e8973a` | The ball in the mono mark and on the charcoal tile.          |
| Tile charcoal       | `#22201c` | The warm tile's field.                                       |
| Charcoal court      | `#f3efe6` | The court and attack line on the charcoal tile.              |

### Expressions

One mark is drawn for several jobs, and every expression keeps the same court, corner ball, and proportions. Each names the asset it ships as.

- **Colour tile.** The full-colour app icon: a rounded tile with the white court, a faint front-zone band, and the amber ball over the corner. It ships as the theme-swapping favicon `public/favicon.svg` and the plain blue `public/brand/favicon-blue.svg`.
- **In-app mono mark.** The only mark used inside the product, monochrome and theme-aware. The court draws in `currentColor`, so it flips with light and dark on its own. The amber ball stays the one constant accent, kept crisp over the court corner by a hairline ring in the surface colour.
- **Minimal cut.** A 16px-tuned variant that drops the front-zone band and thickens the strokes so the court holds at favicon size: `public/brand/favicon-min-blue.svg`.
- **Warm charcoal alternate.** The charcoal-field, warm-amber version of the colour tile and the minimal cut: `public/brand/favicon-charcoal.svg` and `public/brand/favicon-min-charcoal.svg`. It also fills the favicon's dark-mode branch (`@media (prefers-color-scheme: dark)`), warming the tab icon under dark browser chrome wherever the in-SVG query is honoured.

## The lockup

`BrandLockup` pairs the mark with "VolleyCoach" set in Bricolage Grotesque, the app's display face, bold and at the tracking the UI already uses. The mark leads and the word follows as one locked unit, never re-spaced or restyled per surface.

- **Mark to wordmark.** The mark reads a touch taller than the word, about a 1.16 mark-to-text ratio.
- **Gap.** The space between mark and word is about a third of the mark's width.
- **Clear space.** Keep at least one mark-width of empty space on every side of the lockup.

## Usage and single source

`src/shell/BrandMark.tsx` is the single source for the in-product mark: every in-app surface renders `BrandMark` or `BrandLockup`, and none inlines a copy of the glyph. The static assets restate the same geometry only because they cannot import the component. A change to the mark or favicon must therefore keep `src/shell/BrandMark.tsx`, `public/favicon.svg`, and this guide in sync, as the `AGENTS.md` lockstep rule requires. Re-export the Open Graph card `public/og-image.png` from `public/og-image.svg` whenever the lockup changes.

| Surface                                 | Expression                                          |
|-----------------------------------------|-----------------------------------------------------|
| Browser tab / favicon                   | Colour tile, warming to charcoal under dark chrome. |
| Sidebar (wide)                          | `BrandLockup` at the top.                           |
| Sidebar (collapsed rail)                | `BrandMark` alone.                                  |
| Auth and onboarding gates, loading gate | `BrandLockup` above the heading.                    |
| Share view header                       | `BrandLockup`.                                      |
| Link preview (Open Graph)               | The lockup centred on the brand-blue field.         |
