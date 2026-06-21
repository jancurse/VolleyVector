# Rename app: VolleyCoach → VolleyVector

## Implementation Agent Instructions

- **Role**: Frontend engineer doing a careful, repo-wide product rename without touching behaviour.
- **Task**: Rename the app from "VolleyCoach" to "VolleyVector" across all user-facing text, brand assets, docs, and internal/dev-only name strings, leaving the brand mark glyph, production URLs, and applied migration history unchanged.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes: this is a rename, not a refactor. Change only name strings and the assets/tests that depend on them.
    - Preserve casing per context: `VolleyVector` where `VolleyCoach` appeared, `volleyvector` where `volleycoach` appeared.
    - Do not change any `volleycoach.pages.dev` URL or the Cloudflare Pages project name (deferred to #12).
    - Do not edit already-applied migration files under `supabase/migrations/`.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @docs/brand.md and `src/shell/BrandMark.tsx` (the wordmark/lockup)
    - `scripts/generate-brand-assets.ts` (the brand-asset generator)
    - Load the **supabase** skill before touching anything under `supabase/`.
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` per its section description.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task. Re-read the section before declaring done and restate every item verbatim in your final message.

## Plan

### Goal

The name "VolleyCoach" conflicts with another app. Rename to **VolleyVector** ("Volley" keeps it volleyball; "Vector" reflects the SVG court and the vector movement arrows). The brand **mark glyph is unchanged** — only the wordmark text and name strings change.

### What changes

Replace `VolleyCoach` → `VolleyVector` and `volleycoach` → `volleyvector`, in the areas below. All occurrences live in 56 files; the groups below are the deliberate decisions, not a substitute for grepping the repo.

#### 1. In-app text (visible name strings)

- `src/shell/BrandMark.tsx`: the wordmark `<span>VolleyCoach</span>` (and the comment above it).
- `src/sharing/ShareView.tsx`: the `← Open VolleyCoach` back label.
- `src/sharing/GrantAccept.tsx`: the eyebrow `VolleyCoach` and the `Go to VolleyCoach` button.
- `src/invites/InviteAccept.tsx`: the `Join VolleyCoach` fallback title.
- `index.html`: `<title>`, `og:title`, `og:image:alt`. **Leave `og:url` and `og:image` URLs (`volleycoach.pages.dev`) unchanged.**
- `public/manifest.webmanifest`: `name` and `short_name` (hand-written, not generated).

#### 2. Brand assets (name baked in as text/labels)

- `scripts/generate-brand-assets.ts`: the `aria-label="VolleyCoach"` on all three SVGs and the wordmark `<text>…VolleyCoach</text>` in the OG card.
- Regenerate the static assets with `npm run generate:brand`, then commit the regenerated files: `public/favicon.svg`, `public/brand/icon-maskable.svg`, `public/og-image.svg`, and the rasterised PNGs (`public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/apple-touch-icon.png`, `public/og-image.png`).
    - Only `og-image` carries visible wordmark text; favicon/maskable change only the `aria-label`. All must still be regenerated from the updated source so nothing drifts (the brand drift test imports these builders).
    - PNG rasterisation needs a Chrome binary (set `CHROME_BIN` if not auto-found). If no Chrome is available in the environment, stop and flag it — do not hand-edit the generated files.
- The mark geometry (`src/shell/brandMarkGeometry.ts`) does **not** change.

#### 3. Internal / dev-only name strings

- localStorage keys → `volleyvector-*`:
    - `src/theme/useTheme.ts` (`volleycoach-theme`) and the inline bootstrap in `index.html` that reads the same key (must match).
    - `src/editor/draftBackup.ts` (`volleycoach-draft-${boardId}`).
    - `src/bundle/DraftPreview.tsx` (`volleycoach-draft-preview-file`).
- `package.json` and `package-lock.json`: `name` → `volleyvector`.
- `src/index.css`: the header comment.
- Local Supabase project id (renames local docker containers; requires `npm run db:reset` after):
    - `supabase/config.toml`: `project_id`.
    - `scripts/lib.sh`: `SHARED_PROJECT` and `TEMP_PREFIX`, and the related comments (including the stale `supabase_db_VolleyCoach` example).
    - `scripts/db-clean.sh`: the comment referencing the shared stack.
- Test-account email domain `@volleycoach.test` → `@volleyvector.test`:
    - `supabase/seed.sql` (local-only fixtures, re-run on reset) — both the account rows and the header comment.
    - `vite.config.ts` (the seeded dev sign-in accounts).
    - `.github/workflows/pr-review.yml` (the dev.env it writes).
- Dev config path `~/.config/volleycoach/` → `~/.config/volleyvector/`:
    - `vite.config.ts` and `.github/workflows/pr-review.yml`.
- Edge Function header comments (`// VolleyCoach — …`): `supabase/functions/{invite,redeem-invite,delete-account,restore-account,purge-expired}/index.ts`. (Functions deploy fresh, so editing these is safe.)
- `supabase/tests/rls_policies_test.sql`: the header comment only (it is a test file, not an applied migration). Also any `@volleycoach.test` emails it uses, for the domain rename above.

#### 4. Docs

- `README.md`, `AGENTS.md`, `docs/architecture.md`, `docs/brand.md`, `docs/development.md`: every prose use of the app name, the seeded-account emails table, and the dev.env path.
- `.claude/skills/{board-creator,playwright,supabase}/SKILL.md`: the name in descriptions, the container name (`supabase_db_volleycoach`), and the dev.env path.
- **Leave the `volleycoach.pages.dev` URL** (docs/development.md host line, docs/architecture.md host-and-URL line) and the Cloudflare project name in `.github/workflows/deploy.yml` (`--project-name=volleycoach`) **unchanged** — deferred to #12.

### Out of scope (do not change)

- All `volleycoach.pages.dev` production URLs, the Cloudflare Pages `--project-name=volleycoach`, and any old→new redirect — deferred to #12.
- Already-applied migration files under `supabase/migrations/` (their `// VolleyCoach …` header comments stay as historical record; the schema is untouched).
- The brand mark glyph geometry.
- The production Supabase project ref and URL.

### User-only steps

These cannot be done from the repo; the implementer must guide the user through them (use the `user-steps` skill) and confirm completion before declaring done:

- Rename the **Supabase project display name** in the Supabase dashboard (cosmetic; does not change the project ref or URL).
- After merge, each developer runs `npm run db:reset` (the local project id changed) and, if they keep a prod dev.env, moves `~/.config/volleycoach/dev.env` to `~/.config/volleyvector/dev.env`.

### Testing

Update the existing tests that assert on the old name or old keys; add nothing beyond what the rename requires:

- `tests/shell/BrandMark.test.tsx`: wordmark text assertion.
- `tests/print/PrintView.test.tsx`: `document.title` assertions.
- `tests/invites/InviteAccept.test.tsx`: the `Join VolleyVector` heading.
- `tests/theme/useTheme.test.ts` and `tests/App.test.tsx`: the `volleyvector-*` localStorage keys.

### Acceptance Criteria

- All tests pass (`npm run test`).
- All diagnostics pass (use the `diagnostics` skill).
- `npm run build` succeeds.
- A repo grep for `VolleyCoach`/`volleycoach` returns only: the deferred `volleycoach.pages.dev` URLs, the Cloudflare `--project-name=volleycoach`, and the header comments inside applied `supabase/migrations/*.sql` files. Nothing else.
- Brand assets are regenerated from the updated source (not hand-edited), and the brand drift test passes.
- The local stack still builds (`npm run db:reset`) under the new project id, and `npm run dev` comes up signed in with the renamed dev accounts.

## Follow-ups

_None._

## Implementation Notes

_To be filled in by the implementation agent._

### Critical Issues

_To be filled in by the implementation agent._
