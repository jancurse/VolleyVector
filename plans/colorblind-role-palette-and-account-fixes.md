# Colour-blind-safe role palette, and two detail fixes

## Implementation Agent Instructions

- **Role**: Senior design engineer working in a React 19 + TypeScript + Tailwind v4 codebase, fluent in OKLCH colour and the project's token system.
- **Task**: Recolour the marker role palette to be colour-blind-safe and off the danger hue, then apply two detail fixes — matched-height button pairs and a dedicated overlay surface with "Delete account" relocated out of the avatar menu.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - The palette stays theme-independent: identical values in light and dark.
    - Do not break persisted data. `ColorKey` values are stored on markers, annotations, and exported bundles; existing boards must keep rendering.
    - Keep the board-creator skill in lockstep (court colours/roles and any bundle-format change), and keep the example bundle test green.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @src/court/roles.ts
    - @src/ui/styles.ts
    - @src/index.css
    - @src/editor/MarkerInspector.tsx and @src/editor/AnnotationInspector.tsx (the `MARKER_COLORS` consumers)
    - @src/boards/normalize.ts and @src/bundle/parse.ts (read-time normalization, colour validation)
    - @.claude/skills/board-creator/ (`court.md`, `format.md`, `scripts/validate.mjs`, `examples/`)
- **Source of truth**: This plan is complete and self-contained. Implement from it alone; every colour value, file, and rule needed is below. No external design document is required.
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in this plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. If you uncover unplanned work that belongs in its own future project, add it there. Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Goals

- Replace the five volleyball role fills/rings with an OKLCH palette that survives protan/deutan/tritan colour-blindness, holds a near-constant lightness band (0.56–0.66 L), avoids the red (~25–40°) and green (~140°) hue ranges, and never collides with the `--danger` hue.
- Carry the same hue discipline into the basic-mode / annotation ink palette (`MARKER_COLORS`), with no red/green pair and the two most-distinct swatches first.
- Make a paired quiet button match its primary on height, font size, and corner radius; leave lone quiet buttons untouched.
- Give floating overlays their own elevated surface token (lightest layer in light mode, clearly lifted in dark), instead of borrowing `--court-surface`.
- Remove "Delete account" from the avatar menu and place it on the Account settings page behind the existing confirm dialog.

### Non-goals

- No new marker types, hollow/dashed/outline variants, or any "opponent / team-by-fill" encoding. This is a recolour of the existing role set. (`OPP` is the Opposite hitter role, not an opposing player.)
- Do not touch the ball artwork (`src/court/BallArt.tsx`). The coach stays a quiet neutral slate; only its value is re-expressed as the matching OKLCH neutral so it equals the `slate` swatch.
- The role palette is separate from app chrome and brand identity. Leave the UI accent token (`--accent`, today `#2f6fe0`), the brand mark / favicon / OG / PWA-icon assets (`src/shell/BrandMark.tsx`, `public/`), and the PWA manifest theme colours unchanged. They carry the brand blue, not a role colour, even though the old Outside blue happened to match it.
- No new components; Part Two is token/rule/placement changes only.
- No change to access control, the delete-account flow itself, or its confirm dialog.

### Part One — Colour-blind-safe role palette

All values live in `src/court/roles.ts`; the palette stays theme-independent.

- **Volleyball roles (`ROLES`)** — new fill / ring, white label, all else unchanged (sheen gradient, `--marker-edge` rim, drop shadow). Ring is the specified darker shade (~0.14 L below fill):

    | Role               | Fill                   | Ring                   |
    |--------------------|------------------------|------------------------|
    | Setter (gold)      | `oklch(0.64 0.13 72)`  | `oklch(0.50 0.12 68)`  |
    | Outside (blue)     | `oklch(0.58 0.14 258)` | `oklch(0.45 0.13 260)` |
    | Middle (teal)      | `oklch(0.66 0.11 188)` | `oklch(0.51 0.10 190)` |
    | Opposite (magenta) | `oklch(0.61 0.15 350)` | `oklch(0.47 0.14 352)` |
    | Libero (violet)    | `oklch(0.56 0.14 300)` | `oklch(0.44 0.13 300)` |

- **`ball`** unchanged. **`player`** and **`coach`** move with the `blue` and `slate` swatches so the reset-to-role contract below holds:

    | Role   | Fill                   | Ring                   |
    |--------|------------------------|------------------------|
    | Player | `oklch(0.58 0.14 258)` | `oklch(0.45 0.13 260)` |
    | Coach  | `oklch(0.52 0.02 250)` | `oklch(0.40 0.02 250)` |

    Player becomes one canonical blue shared with Outside; coach stays a quiet neutral, re-expressed in OKLCH.

- **Basic-mode / annotation ink (`MARKER_COLORS`)** — retune to the role hues, no red/green pair, ordered so the first two swatches are the most-distinct pair (blue, then amber):

    | Swatch  | Fill                   | Ring                   |
    |---------|------------------------|------------------------|
    | Blue    | `oklch(0.58 0.14 258)` | `oklch(0.45 0.13 260)` |
    | Amber   | `oklch(0.66 0.12 72)`  | `oklch(0.52 0.11 68)`  |
    | Teal    | `oklch(0.66 0.11 188)` | `oklch(0.51 0.10 190)` |
    | Magenta | `oklch(0.61 0.15 350)` | `oklch(0.47 0.14 352)` |
    | Violet  | `oklch(0.56 0.14 300)` | `oklch(0.44 0.13 300)` |
    | Slate   | `oklch(0.52 0.02 250)` | `oklch(0.40 0.02 250)` |

- **Reset-to-role contract:** `MARKER_COLORS.blue.fill === ROLES.player.fill` and `MARKER_COLORS.slate.fill === ROLES.coach.fill` must stay exactly equal, so a recoloured marker can be set back to its role default (the inspector matches on fill).
- **Colour-key persistence (correctness requirement, mechanism is the implementer's choice).** `ColorKey` is a stored identifier: it lives on `Marker.color`, on **every** `AnnotationStyle.color` (each drawn line/arrow/shape/text), and in exported bundles, and is read unguarded as `MARKER_COLORS[key]`. The dropped `red`/`green` keys must keep loading: an existing board, annotation, or bundle that stored `red` or `green` must render correctly (as magenta and teal respectively) with no crash and no data loss. Either retune the existing keys' values in place, or rename keys and map the legacy values at every read path (`src/boards/normalize.ts`, the board store load in `src/supabase/rows.ts`, and `src/bundle/parse.ts`) — whichever yields correct output. Do not leave `MARKER_COLORS[storedKey]` able to resolve to `undefined`.
- **Knock-on (annotations):** `MARKER_COLORS` is also the annotation colour palette, so this retune changes the annotation colour picker and re-renders existing annotations whose stored key's value moved. Expected; verify annotation colours alongside markers.
- **Containment (already verified):** every court consumer derives its colour from `ROLES`/`MARKER_COLORS` — `Marker`, `MarkerSwatch`, `MarkerPalette`, `RotationDiagram`, `Arrows`, `Annotations`, and the marker/annotation inspectors. No role hex is hardcoded anywhere else in `src/`, so editing `roles.ts` propagates everywhere with no other component changes. The recolour reaches the full court, legends, thumbnails, rotation diagram, arrows, and annotations by construction.

### Part Two — Two detail fixes

In `src/ui/styles.ts` and `src/index.css`; no new components.

#### Fix 1 — Paired buttons match height

- **Rule (principle):** when a quiet button (`ghost`/`text`/`dashed`) sits beside a `primary` or `danger` in the same action row, the two must match on **font size, vertical padding, and corner radius** so heights and text baselines align. Hierarchy then comes from fill-vs-quiet chrome, not size. The quiet button keeps its quiet chrome (transparent/bordered, dim text); only its size is brought up. Horizontal padding may stay slightly tighter.
- **Why this is currently broken everywhere:** `buttonClass` gives every quiet variant `BUTTON_SIZE_QUIET` (one scale step down in font and vertical padding) regardless of the `size` prop, while `primary` gets `BUTTON_SIZE`. So a quiet button and a primary at the *same* `size` still render at different heights. This means **every** primary+quiet side-by-side pair is mismatched today, not only the few that pass different `size` props.
- A lone/standalone quiet button keeps its current smaller footprint: the inspector "Remove" (`MarkerInspector`, `AnnotationInspector`), the `dashed` add-affordances (`BoardEditor` "Add step", `NoteEditor` "+ Text block"/"+ Board group"), inline `text` actions (`BoardEditor` "Copy drawings to next step", history "Restore"/"Back"), a header nav button (`PrintView` "← Back"), a quiet link stacked under a submit (`InviteAccept` mode toggle, `GrantAccept` "Go to VolleyCoach"), and a quiet button paired with an input rather than another button (`OutsideTeamShare`, `AccessManager`, `AccessList` add-row, `InviteDialog` copy).
- The pairing is opt-in per call site, since `buttonClass` cannot tell a paired button from a lone one. Suggested mechanism (implementer's choice): a prop or `size` value on `Button` that makes a quiet variant adopt the primary's height/font/radius while keeping its quiet chrome; apply it to the quiet button in each pair below.
- **Authoritative pair list** (every primary/danger + quiet side-by-side action row; all are mismatched today):
    - `AlertDialog` footer (`src/ui/AlertDialog.tsx`) — `ghost` Cancel + `primary` confirm. **Fixing this one covers every confirm dialog in the app**, including the relocated Delete account.
    - `BoardEditor` top bar (`src/editor/BoardEditor.tsx`) — `text` Cancel + `primary` Done.
    - `NoteEditor` top bar (`src/notes/NoteEditor.tsx`) — `text` Cancel + `primary` Done.
    - `ImportDialog` footer (`src/bundle/ImportDialog.tsx`) — `ghost` Cancel + `primary` Import.
    - `ReplaceBoardDialog` footer (`src/bundle/ReplaceBoardDialog.tsx`) — `ghost` Cancel + `primary` Replace.
    - `DraftPreview` footer (`src/bundle/DraftPreview.tsx`, dev-only preview) — `ghost` Back + `primary` Import.
    - `SettingsPage` name editor (`src/account/SettingsPage.tsx`) — `primary` Save + `ghost` Cancel.
    - `TeamPage` action bar (`src/team/TeamPage.tsx`) — `ghost` Join/Leave beside `primary` Invite member.
- Already consistent: `AdminPage`'s Archive/Unarchive + Delete row (both `ghost`/`danger` at `size="sm"`) and `NoteView`'s two ghosts — same variant family, no primary in the row; leave as-is.

#### Fix 2A — Dedicated overlay surface

- Add an elevated overlay surface token in `src/index.css`: **lightest** surface in light mode (~`#fdfcf8`, lighter than the `#f1eee6` page) and a clearly **lifted** surface in dark mode (a step lighter than `--bg` `#0c0e13`, distinct from `--court-surface`). Map it as a colour utility and point `OVERLAY_SURFACE` at it instead of `bg-court-surface`. Keep the existing `--shadow-overlay` and border.
- Switch **every** floating overlay to it: `Menu` (dropdown + submenu), `Select` listbox, `Combobox`, `PrincipalPicker`, `Popover`, `Tooltip` (today it hardcodes `bg-court-surface`), and the confirm modals `Dialog` and `AlertDialog`. Most ride `OVERLAY_SURFACE`; `Tooltip`, `Dialog`, and `AlertDialog` set `bg-court-surface` directly and must be repointed too.
- Do **not** switch the court-floor and chrome surfaces: `CourtFrame`, `BoardPrint`, `RotationBoard`, the `LibraryCard`/`BoardGroupBlock`/`BundlePreview` thumbnails, the `Sidebar`/`SidebarRail` tint, and the `BrandMark` SVG.

#### Fix 2B — Relocate "Delete account"

- Remove the "Delete account" item (and the divider that isolates it) from `AvatarMenu` so the menu ends on "Sign out"; drop the now-unused `onDeleteAccount` prop and update the `App` wiring.
- Add a bounded destructive-action section to `SettingsPage` with a Delete account (`danger`) button that triggers the existing confirm flow (`deleteOwnAccount` in `App`, reusing the current danger `AlertDialog`). Thread the flow into `SettingsPage`.
- Update the `SettingsPage` comment that states delete lives in the avatar menu. (Note: the only existing reference is that code comment — there is no user-facing copy to change — and the new section needs its own short intent copy.)
- Keep the theme toggle in the menu.

### Documentation and comments

Update every doc and comment these changes make stale, in the same change. Match the density of the surrounding prose; do not pad.

- **`docs/architecture.md`**:
    - The account-control description (the top-bar paragraph) lists "**Delete account**" as a menu item — move it to the Account settings page in the text.
    - The role/colour palette description and the `MARKER_COLORS` line — reflect the new hues (Middle teal, Opposite magenta; basic-mode palette has no literal red/green). Keep the "theme-independent, a blue Outside is always blue" framing.
    - If it describes overlay surfaces / `--court-surface`, note that floating overlays now use the dedicated elevated surface.
- **`docs/style_guide.md`** (UI Controls): add the paired-button rule (a quiet button paired with a primary/danger in an action row matches its height/font/radius; a lone quiet button stays smaller), so the principle is documented, not just applied.
- **Board-creator skill** (`.claude/skills/board-creator/`): `court.md` role→colour table (Middle green→teal, Opposite red→magenta, plus the new role hues) and `format.md` colour-key list — kept in lockstep with `scripts/validate.mjs` and `examples/` per Constraints.
- **In-code comments**: `src/court/roles.ts` (the `MARKER_COLORS` "blue/slate match player/coach" note), `src/ui/styles.ts` (`OVERLAY_SURFACE`), `src/index.css` (the `--court-surface`/overlay token notes), `src/shell/AvatarMenu.tsx` (drop "delete account" from its summary), `src/account/SettingsPage.tsx` (the "delete account stays in the avatar menu" line).
- **No change needed** to `docs/brand.md` (brand mark and favicon are unchanged) or `AGENTS.md`/`CLAUDE.md`.

### Constraints

- Theme-independent palette: light and dark identical (`roles.ts`, not the `[data-theme]` blocks).
- Persisted-data safety and the reset-to-role equality as specified in Part One.
- Board-creator skill lockstep: update `court.md` (role→colour table: middle now teal, opposite now magenta, plus the new role hues), `format.md` (colour-key list if keys change), `scripts/validate.mjs` (`COLORS` if keys change), and `examples/warmup-pepper.json` (uses `color: "red"`); keep `tests/bundle/examples.test.ts` green. Bump `FORMAT_VERSION` only if the bundle shape actually changes (a value-only retune does not; a leniently-normalized key rename need not).
- `OVERLAY_SURFACE` is the single source for overlay chrome — do not restyle overlays ad hoc.

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill for frontend tests.

- A `roles.ts` invariant test: the reset-to-role equalities hold, `COLOR_KEYS`' first two are the distinct pair, and the `ColorKey` set is as intended.
- A persistence test that a board/annotation/bundle storing the legacy `red`/`green` keys still loads and resolves to magenta/teal (location depends on the chosen mechanism).
- `AvatarMenu`: no "Delete account" item; menu ends on "Sign out". `SettingsPage`: a Delete account action that opens the confirm dialog.
- Keep `tests/bundle/examples.test.ts` passing after the skill update.
- The colour-blind separation, lightness band, and label contrast are inherently visual: verify with a simulator (Chrome DevTools → Rendering → Emulate vision deficiencies) across protan/deutan/tritan, **on the court and on the unlabeled thumbnail**, plus the new overlay surface and matched buttons in light and dark.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- No role fill in the red (~25–40°) or green (~140°) hue ranges; none collides with `--danger`; all five fills within 0.56–0.66 L.
- Every adjacent role pair stays distinguishable under deutan/protan/tritan, on the court and on the unlabeled thumbnail; white labels keep ≥3:1 large-text contrast on every fill.
- Palette identical in light and dark.
- `MARKER_COLORS` carries no red/green pair; its first two swatches are the most-distinct pair; recoloured markers still reset to their role colour; existing boards/annotations/bundles still load.
- Any primary+quiet action pair shares height, font size, and radius with aligned baselines; lone quiet buttons are unchanged.
- Every targeted popup sits on the new overlay surface and reads as the lightest layer in light mode; dark-mode overlays still read as lifted (no regression).
- "Delete account" no longer appears in the avatar menu; it lives in Settings behind the existing confirm dialog; the stale settings reference is gone.
- Every doc and comment listed under "Documentation and comments" is updated; `docs/brand.md`, `AGENTS.md`, and `CLAUDE.md` are correctly left unchanged.

## Follow-ups

*None.*

## Implementation Notes

### Part One — palette

- `src/court/roles.ts` now carries the OKLCH role fills/rings, the retuned `MARKER_COLORS`, and the colour-key plumbing.
- **Colour-key mechanism: rename + legacy resolver** (the plan's second option). `ColorKey` is now `blue | amber | teal | magenta | violet | slate`; the dropped `red`/`green` map via `LEGACY_COLOR_KEYS` (`red→magenta`, `green→teal`) through a new `resolveColorKey(key): ColorKey | null`. Chosen over retuning `red`/`green` in place so no key name lies about its colour, matching the plan's lockstep list (example bundle, `format.md`, `validate.mjs` all updated). `FORMAT_VERSION` unchanged — the bundle shape did not change and the rename normalizes leniently on read.
- **Read paths mapped** so a stored legacy key never reaches `MARKER_COLORS[key]` as a dropped/undefined value:
    - `src/boards/normalize.ts` — `normalizeAnnotation` remaps colour for every kind; new `normalizeMarkers` remaps marker colour.
    - `src/supabase/rows.ts` — `boardFromRow` and `boardFromRevision` run markers through `normalizeMarkers` (annotations already go through `normalizeSteps`).
    - `src/bundle/parse.ts` — `parseAnnotation` and the marker-colour check use `resolveColorKey` (mapping legacy rather than dropping/erroring); the now-dead `isColorKey` was removed.
- Reset-to-role equality holds: `MARKER_COLORS.blue` equals `ROLES.player`, `MARKER_COLORS.slate` equals `ROLES.coach` (identical literal strings, guarded by a `roles.test.ts` invariant). Ball, and every other role's `text`, are unchanged.

### Part Two — detail fixes

- **Paired buttons**: added a `paired` prop to `Button` and a third arg to `buttonClass`; a quiet variant with `paired` takes the primary's `BUTTON_SIZE` (height/font/radius) while keeping quiet chrome. Applied to the quiet side of all eight listed pairs (AlertDialog covers every confirm dialog). Lone quiet buttons untouched.
- **Overlay surface**: new `--overlay` token (light `#fdfcf8`, dark `#1b212c`) mapped to `bg-overlay`; `OVERLAY_SURFACE` repointed, and `Tooltip`/`Dialog`/`AlertDialog` (which hardcoded `bg-court-surface`) repointed. Court-floor/chrome surfaces left on `court-surface`.
- **Delete account relocated**: removed from `AvatarMenu` (and its `onDeleteAccount` prop); added a bounded danger section to `SettingsPage` wired to the existing `deleteOwnAccount` confirm flow via a new `onDeleteAccount` prop; `App` rewired.

### Docs, tests, verification

- Updated `docs/architecture.md` (palette description, account-control paragraph, overlay surface), `docs/style_guide.md` (paired-button rule), and the board-creator skill (`court.md`, `format.md`, `validate.mjs`, `examples/warmup-pepper.json`). `docs/brand.md`, `AGENTS.md`, `CLAUDE.md` left unchanged as specified.
- Tests: rewrote `tests/court/roles.test.ts` (invariants + `resolveColorKey`), added legacy-key coverage to `tests/boards/normalize.test.ts` and `tests/bundle/parse.test.ts`, updated the `App.test.tsx` account-deletion and basic-mode-colour tests, and swapped retired keys in existing fixtures. All 543 tests pass; lint, typecheck, format, and the standalone validator are green.
- Numeric criteria verified by inspection (lightness 0.56–0.66; hues clear of red/green and `--danger`). The colour-blind-simulator and contrast checks across protan/deutan/tritan in light and dark (court, unlabeled thumbnail, overlay, matched buttons) are inherently visual and remain for the user's visual review; the OKLCH values are exactly as the plan fixed them.

### Critical Issues

None.
