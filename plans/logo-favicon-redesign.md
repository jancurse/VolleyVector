# Brand logo & favicon redesign

## Implementation Agent Instructions

- **Role**: Frontend engineer with a brand/visual-systems eye, working in React 19 + TypeScript + Tailwind v4.
- **Task**: Replace the placeholder brand glyph and favicon with the new "cropped board" volleyball mark across every brand surface, sourced from a single component so the variants never drift.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - Single-source the in-product mark: no duplicated inline SVG copies anywhere.
    - Match the design sheet's geometry and colours exactly (see `### Mark geometry` below).
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - `docs/architecture.md` — the "UI components and styling" section (brand mark + favicon).
    - `plans/VolleyCoach Logo & Favicon.html` — the design sheet (a gzipped bundle; the geometry is transcribed in this plan so it need not be unpacked).
    - `src/shell/BrandMark.tsx`, `src/shell/Sidebar.tsx`, `src/shell/SidebarRail.tsx`, `src/sharing/ShareView.tsx`
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` per its section description.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects — do not implement them. Restate each in your final report.

## Plan

### Goal

Bring every brand surface onto one deliberate mark: **the app's board, cropped** — a rounded tile holding the
white court (boundary + attack line) with the ball breaking the top-right corner, like a serve clearing the net.
Replace the current generic "square-and-dot" court-grid glyph and the monochrome favicon.

### Mark geometry (from the design sheet)

All variants share the same court: a rounded-square boundary, an attack line one third down, and a ball over the
top-right corner. Transcribed SVG sources:

- **Colour tile** (app icon / favicon base), `viewBox="0 0 100 100"`:
    - `rect x=0.5 y=0.5 w=99 h=99 rx=22 fill=#2f6fe0` (blue) — charcoal variant `fill=#22201c`
    - front-zone band: `rect x=23 y=23 w=54 h=18 fill=#ffffff opacity≈0.14` (charcoal: `#f3efe6` @0.10)
    - court: `rect x=23 y=23 w=54 h=54 rx=5 fill=none stroke=#ffffff stroke-width=2.6` (charcoal stroke `#f3efe6`)
    - attack line: `line 23,41 → 77,41 stroke=#ffffff stroke-width=1.8 opacity≈0.9` (charcoal `#f3efe6` @0.85)
    - ball at `translate(77,23)`: `circle r=7.5 fill=tile-colour` (ring) then `circle r=6.2 fill=#FFC61E`
      (charcoal: `#e8973a`), optional top-down sheen gradient.
- **In-app mono mark** (`currentColor`, theme-aware), `viewBox="0 0 24 24"`:
    - `rect x=3.5 y=3.5 w=17 h=17 rx=3.5 fill=none stroke=currentColor stroke-width=1.6`
    - `line 3.5,9.2 → 20.5,9.2 stroke=currentColor stroke-width=1.4 opacity=0.7`
    - `circle cx=20.5 cy=3.5 r=2.8 fill=#e8973a` — add a hairline ring in the surface colour
      (`var(--court-surface)` / `var(--bg)`) behind the ball so it stays crisp over the court corner.
- **Minimal cut** (16px favicon), `viewBox="0 0 100 100"`: drops the front-zone band, heavier strokes —
  `rect …rx=22 fill=tile`, court `rect x=20 y=20 w=60 h=60 rx=5 stroke-width=3.4`, attack `line 20,40 → 80,40
  stroke-width=2.6`, ball `translate(80,20)`: `circle r=11 fill=tile` + `circle r=9 fill=#FFC61E/#e8973a`.

Colours: tile blue `#2f6fe0`, court white `#ffffff`, tile ball amber `#FFC61E`, in-app/charcoal amber
`#e8973a`, tile charcoal `#22201c`, charcoal court `#f3efe6`. Amber is hardcoded in the mark, not a theme token.

### Requirements

- **One source for the in-product mark.** Rework `src/shell/BrandMark.tsx`:
    - `BrandMark({ size })` renders the **mono** mark above. Keeps the existing `currentColor` contract so it
      tints with light/dark theme on its own; the amber ball is the one constant accent.
    - Add `BrandLockup({ size })`: the mark + "VolleyCoach" in `font-display` (Bricolage Grotesque, bold,
      already loaded), as one locked unit — mark height ≈ cap height, gap ≈ ⅓ mark width, clear space ≥ one
      mark-width. This replaces ad-hoc `mark + <span>` pairings.
- **In-product call sites:**
    - `src/shell/Sidebar.tsx` (~line 60) — use `<BrandLockup />` in place of the hand-built mark+span.
    - `src/shell/SidebarRail.tsx` (~line 102) — keep `<BrandMark />` (mark-only on the collapsed rail).
    - `src/sharing/ShareView.tsx` (~lines 74–78) — delete the inline duplicate glyph; render the component.
- **Favicon** (`public/favicon.svg`) — rebuild from the colour-tile geometry and make it **theme-responsive**:
  an inline `<style>` with `@media (prefers-color-scheme: dark)` swaps tile blue→charcoal, court white→`#f3efe6`,
  ball→`#e8973a`. `index.html` already links `/favicon.svg`; no link change.
- **Ship the warm variant ready-to-swap.** The charcoal/amber colour-tile and minimal-cut art must exist as
  finished assets (in the favicon's dark-mode branch, and as a documented standalone the team can promote to
  primary), so a future switch from the blue brand to a warm theme is an icon swap, not a redraw.
- **Auth surfaces** — replace the unmarked `EYEBROW` text above "Sign in" in `src/auth/Login.tsx` (~line 45)
  and `src/auth/SetPassword.tsx` with `<BrandLockup />`; add the lockup to the loading gate in
  `src/App.tsx` (~line 501), which is currently blank text.
- **Share / OG link preview** — add a 1200×630 brand card and Open Graph + Twitter Card meta tags to
  `index.html` (`og:title`, `og:description`, `og:image`, `og:type`, `og:url`, `twitter:card`); none exist
  today. Ship the card as `public/og-image.png` (link-preview scrapers do not reliably render an SVG
  `og:image`), and keep the editable SVG source it is exported from in the repo alongside it.
- **Documentation** — keep the docs from drifting from the new brand:
    - Rewrite the stale descriptions of the old court-grid glyph and dark-tile favicon: the Lucide-icons
      exception clause in `AGENTS.md` (~line 35) and the brand-mark/favicon sentences in the "UI components and
      styling" section of `docs/architecture.md` (~line 316).
    - Add `docs/brand.md`: a short brand guide covering the mark concept, its expressions (colour tile, mono
      in-app, minimal cut, charcoal alternate) with colours, the lockup rule (proportions + clear space), where
      each expression is used, and that `src/shell/BrandMark.tsx` is the single source for the in-product mark.
      Reference it from `docs/architecture.md`.
    - Add a lockstep rule to `AGENTS.md` (mirroring the existing board-creator-skill rule): a change to the
      brand mark or favicon must keep `src/shell/BrandMark.tsx`, `public/favicon.svg`, and `docs/brand.md` in
      sync, and the in-product mark stays single-sourced (no inline copies).

### Non-goals

- Per-board OG previews. The app is an SPA on a static host, so all links share the one app-wide card; per-board
  images would need server/edge rendering.
- A new theme/colour token for the amber accent.
- Apple-touch-icon / PWA web manifest (home-screen install icon) — deferred at the time, since implemented (see Follow-up 3).

### Constraints

- Theme-responsive SVG favicons render in Firefox and Safari; Chrome support for the in-SVG media query on
  favicons is partial and may fall back to the blue tile. This is acceptable — blue is the default brand.
- `BrandMark`'s public API stays `BrandMark({ size })` so existing render sites keep compiling.

### Testing

Add or update unit tests only as the changes require (use the `react-testing` skill). Cover that `BrandMark`
and `BrandLockup` render with the expected accessible name / structure, and update any existing test that
renders the old glyph (search `tests/` for brand/mark/sidebar renders).

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill).
- The new mark renders in the sidebar (full + collapsed rail), share view, login, set-password, and loading
  gate, with no duplicated inline brand SVG remaining.
- The in-app mono mark tints with light/dark theme via `currentColor`; the amber ball stays constant.
- `public/favicon.svg` is the new court mark and adapts blue/charcoal to the browser's light/dark chrome.
- A shared app link unfurls with the brand card (Open Graph tags present and pointing at a 1200×630 image).
- Docs match the new brand: no remaining reference to the old court-grid glyph or dark-tile favicon;
  `docs/brand.md` exists; and `AGENTS.md` carries the brand lockstep rule.

## Follow-ups

1. **Bring the remaining onboarding gates onto the brand lockup.** Two pre-app gates still render the old unmarked eyebrow `<p className={EYEBROW}>VolleyCoach</p>`, the exact pattern this redesign replaced on Login and SetPassword. The design sheet's instruction is "the full lockup … replacing the unmarked eyebrow", which covers them; the plan's prose just enumerated three files and missed these two instances of the same pattern. This is a gap in the plan, not a deliberate exclusion, and there is no design reason to leave the four gate screens inconsistent.
    - **Done.** Both gates now render `<BrandLockup />` in place of the `EYEBROW` "VolleyCoach" text, with `mt-3` on the following heading and `EYEBROW` dropped from the `../ui/styles` import. The optional per-screen render assertion was skipped to match the shipped Login/SetPassword convention, where the lockup is covered once in `tests/shell/BrandMark.test.tsx`. Diagnostics and the full suite (505 tests) pass.
    - **Files (each is a full-screen gate built from the same `BACKGROUND` + `PANEL` as Login/SetPassword):**
        - `src/account/NameSetup.tsx` (~line 43): the first-login display-name gate, analogous to SetPassword.
        - `src/invites/InviteAccept.tsx` (~line 110): the invite-link landing, analogous to Login.
    - **Change, per file (identical to the Login/SetPassword edit already shipped):**
        - Replace `<p className={EYEBROW}>VolleyCoach</p>` with `<BrandLockup />`.
        - Add `mt-3` to the following `<h1>` (the eyebrow's `mb-[0.4rem]` no longer provides the gap).
        - Add `import { BrandLockup } from "../shell/BrandMark";`.
        - Drop the now-unused `EYEBROW` from the `../ui/styles` import (both files still use `cx`, `MUTED`, and `PANEL`, so keep those).
    - **Verify:** run the diagnostics skill (format, lint, typecheck) and `npm run test`. Optionally add a render assertion (in `tests/shell/BrandMark.test.tsx` or a per-screen test) that each gate shows the lockup.
    - **Scope check already performed (so this follow-up is the whole job):**
        - These are the *only* two remaining "VolleyCoach" brand eyebrows. Every other `EYEBROW` in the app is a page/section label (Library, Team, Admin, Note, Position/Sequence, Account, Not found, Note revision, Dev only) and must stay; the `EYEBROW` style keeps that non-brand role.
        - `"← Open VolleyCoach"` in `ShareView` is a back-button label, not a brand placement, and stays as text.
        - No inline brand-glyph duplicates remain anywhere in `src` (the mark is single-sourced in `BrandMark.tsx`).
    - **Separate, optional (a design call, *not* part of this fix):** the print handouts (`src/print/BoardPrint.tsx`, `src/print/NotePrint.tsx`) carry no brand mark at all. The redesign never covered print, so this is not a missed instance of the eyebrow pattern. If branded paper handouts are wanted, a small `BrandLockup` in the print header or footer is where it would go; decide that deliberately before adding it.
2. **Tighten `docs/brand.md` and align the new docs with the Markdown rules.** It runs ~80 lines where the plan asked for a short guide, and it breaks `AGENTS.md`'s Markdown rules.
    - **Done.** `docs/brand.md` is rewritten to 48 lines (from 80): a real `#`/`##`/`###` hierarchy (the five flat `##` sections folded into `## The mark`, `## The lockup`, and `## Usage and single source`), asset paths collapsed into the Expressions bullets, flowing prose with no em dashes, the forward-looking asides dropped, and every required topic kept. `docs/architecture.md` and the `AGENTS.md` brand additions were audited and already read as flowing prose, so they were left unchanged.
    - **Hierarchy:** replace the flat stack of `##` sections (Colours, Expressions, Lockup, Where-each-lives, Single source) with a real `#`/`##`/`###` structure, merging the tiny and overlapping ones.
    - **Redundancy:** the asset paths repeat across the Expressions "Sources" bullets, the "Where each lives" table, and the "Single source" section, so collapse them to one place; aim for ~40-50 lines.
    - **Prose:** rewrite the one-sentence-per-line text into flowing sentences that break only at a change of thought, never mid-sentence.
    - **Asides:** drop the forward-looking ones (the "future warm theme" rationale and the "PWA deferred follow-up" note).
    - **Keep** every plan-required topic (concept, expressions with colours, the lockup rule, where each is used, the single-source note), and audit `docs/architecture.md` and the `AGENTS.md` additions for the same one-sentence-per-line issue.
3. **Home-screen / PWA app icon.** Brand the installed or pinned app icon that the redesign deferred as a non-goal, so VolleyCoach on a phone or desktop home screen shows the court tile rather than a default.
    - **Done.** A new full-bleed colour-tile source `public/brand/icon-maskable.svg` (no rounded corners, since the OS masks its own shape) holds the court and ball scaled to 0.8 about centre, so no circular or squircle crop clips them. It rasterises with headless Chrome (as the OG card does) to `public/apple-touch-icon.png` (180), `public/icons/icon-192.png`, and `public/icons/icon-512.png`. `public/manifest.webmanifest` lists the SVG favicon as `any` plus the two PNGs as `maskable`, with brand-blue `theme_color` and `background_color`. `index.html` gains the `apple-touch-icon` and `manifest` links, and `docs/brand.md` documents the new expression and its single source.
    - **Why both an apple-touch icon and a manifest:** iOS reads its own `apple-touch-icon` link for the home-screen icon, while Android, Chrome, and desktop read the manifest's `icons`. Shipping both covers every install surface.
    - **No backend and no routing change:** the icons are static assets. Cloudflare Pages serves an existing file before the `_redirects` SPA fallback, so the manifest and PNGs resolve without touching `_redirects`.
    - **Verify:** diagnostics (format, lint, typecheck) and `npm run build` pass, and the rendered 192px PNG shows the tile with the court and ball inside the maskable safe zone.
4. **Per-board share previews (deferred).** Server-side or edge rendering of a board-specific OG image and per-link meta tags, so a shared board link unfurls with that board rather than the generic brand card. Deferred because it is not an asset task: it needs edge rendering (Cloudflare Pages Functions) and path-based share URLs a scraper can reach, since today's `#/share/<token>` hash route is invisible to crawlers. That is a separate project that cuts against the app's no-application-server architecture, so it stays out of this brand work.

## Implementation Notes

The in-product mark is now single-sourced in `src/shell/BrandMark.tsx` (`BrandMark` for the mono mark, `BrandLockup` for the mark-plus-wordmark unit), rendered by the sidebar, collapsed rail, share header, login, set-password, and loading gate. The favicon, the standalone warm/blue tiles under `public/brand/`, and the Open Graph card are static assets that restate the same geometry, kept honest by the new lockstep rule.

### Critical Issues

- None. All acceptance criteria are met: format, lint, typecheck, and build are clean, and the suite passes (505 tests).

### Decisions and deviations

- **The mono mark adds a hairline ring.** The design sheet's `vc-mono` symbol omits it, but the plan and design prose require it, so `BrandMark` draws an `r=3.4` disc in `var(--court-surface)` behind the `r=2.8` amber ball so the ball stays crisp over the court corner.
- **The lockup ratio follows the rendered design, not the literal "cap height" wording.** Every lockup in the sheet sets the wordmark smaller than the mark (mark ≈ 1.16 × font size), so `BrandLockup` uses `fontSize = size / 1.16` and `gap = size / 3`. Reading "mark height = cap height" literally would make the word larger than the mark, which contradicts the sheet's own renders.
- **The ring colour is `var(--court-surface)`** (the design's "surface colour"): invisible on the sidebar, the mark's permanent home, and a barely-perceptible hairline on the bg-backed auth and loading surfaces.
- **The favicon is blue by default and charcoal under dark browser chrome**, per the plan. Chrome's support for the in-SVG `prefers-color-scheme` query is partial and may fall back to blue, which is acceptable since blue is the default brand.
- **The OG card was built, not extracted** (the sheet describes it but does not draw it): `public/og-image.svg` is the lockup centred on the brand-blue field, rasterised to the 1200×630 `public/og-image.png` with headless Chrome. The editable SVG pulls Bricolage Grotesque from Google Fonts via `@import`.
- **The warm variant ships as four standalone assets** under `public/brand/` (blue and charcoal × full tile and minimal cut) plus the favicon's dark branch, so promoting the warm brand to primary is a file swap rather than a redraw.

### Known gap, now resolved (Follow-up 1)

- `src/account/NameSetup.tsx` and `src/invites/InviteAccept.tsx` originally kept the old `EYEBROW` "VolleyCoach" text. The main pass followed the plan's explicit auth-surface list (Login, SetPassword, loading gate) and left these two, even though they are the same gate pattern, so this was a gap in the plan's enumeration rather than a deliberate exclusion. It was written up as Follow-up 1 and is now implemented: both gates render `<BrandLockup />`.

### Verification

- `npm run format`, `npm run lint`, `npm run typecheck`, and `npm run build` all pass clean.
- `npm run test`: 505 passed across 45 files, including the new `tests/shell/BrandMark.test.tsx`.
- Visual QA via headless Chrome confirmed the OG card (Bricolage font and centring), the live favicon's blue/charcoal swap, the minimal cuts holding at 16px, and the in-app mark and lockup on dark and light sidebar and page backdrops.
