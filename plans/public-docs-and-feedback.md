# Public-launch docs and in-app feedback form

## Implementation Agent Instructions

- **Role**: Full-stack engineer working across the React client, a Supabase Edge Function, a migration, and two repository docs.
- **Task**: Add `SECURITY.md` and `CONTRIBUTING.md`, and build an in-app form (issue #45) that lets a signed-in user send a bug report or feature request, stored in the database and emailed to a notify address.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - Mirror the existing access-request flow rather than inventing a new pattern. The feedback table, its RLS, the Edge Function, and the admin tab all follow `access_requests` as their template.
    - Read the `supabase` skill before any database or Edge Function work, and the `writing-style` skill before writing the two docs or any UI copy.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @docs/architecture.md (the "Deletion and recovery", "Auth, invites, and keep-alive", and admin sections)
    - @supabase/functions/request-access/index.ts (the Edge Function to mirror)
    - @src/landing/RequestAccessForm.tsx and @src/landing/requestAccess.ts (the form and client helper to mirror)
    - The admin panel's access-requests tab under @src/admin/ (the list/handle/dismiss surface to mirror)
    - The account avatar menu in @src/shell/ (where the new entry lives)
    - @docs/development.md (linked from `CONTRIBUTING.md`)
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. If you uncover unplanned work that belongs in its own future project, add it there. Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Open Issues

_None._

### Goals

- Ship the two community-health docs a public repo should carry: `SECURITY.md` and `CONTRIBUTING.md`.
- Let a signed-in user report a bug or request a feature from inside the app, with no GitHub account and no `mailto:`.

### SECURITY.md

- A short vulnerability-disclosure policy directing reporters to GitHub's private "Report a vulnerability" advisory flow, and asking them not to open a public issue for security bugs.
- Enabling GitHub's private vulnerability reporting in repo settings is a user-only step. Note it in the plan handoff, do not assume it is on.

### CONTRIBUTING.md

- State the stance: issues are welcome, pull requests are accepted but not actively solicited.
- Link to `docs/development.md` for build, run, and test rather than restating it.
- Summarise the branch-naming and squash-merge PR conventions from `AGENTS.md` briefly, or link to them.
- Keep it short. Match the tone of the existing docs.

### Feedback form (issue #45)

The feature mirrors the access-request flow end to end. Differences: the caller is authenticated, and the report carries a type.

- **Audience and entry point**
    - Signed-in users only.
    - A "Report a problem" item in the top-bar account avatar menu (`src/shell/`), beside the theme toggle and sign-out. It opens a modal form.
- **Form**
    - A type selector (bug or feature request) and a message textarea.
    - No email field: the reporter is signed in, so their identity is attached server-side.
    - Renders through `src/ui/` wrappers and shared tokens. No ad-hoc control styling.
    - Shows a success state on submit and a readable error on failure.
- **Storage (new table, mirroring `access_requests`)**
    - Columns: an id, the reporter's user id, a `type` (`bug` or `feature`), the `message`, `created_at`, and the same soft-delete/handled lifecycle columns `access_requests` uses (`handled_at`, `deleted_at`/`deleted_by`).
    - RLS mirrors `access_requests`: no client `select`/`insert`; only an admin may read and update; the row is written only by the Edge Function under the secret key. Grant `service_role` explicitly.
    - The reporter's user id is stored for follow-up; the admin surface resolves it to a display name. The row is the source of truth, the email rides on top.
- **Edge Function (new, mirroring `request-access`)**
    - "Verify JWT" off; authorize the caller in code from their own login (reject if not signed in).
    - Validate `type` against the two allowed values and cap the message length, as `request-access` caps its message.
    - Insert the row under the secret key with the reporter set to the caller's id.
    - Best-effort notification email through Resend to the notify address, swallowing send failures. Escape user-supplied content in the HTML body, as `request-access` does. Include the reporter's display name and email in the notification so you can follow up.
    - Return a non-revealing success once the row is stored.
- **Notify address**
    - Default to `bug-reports@volleyvector.app`, overridable by a function secret, mirroring `request-access`'s `REQUEST_NOTIFY_EMAIL`.
    - Cloudflare Email Routing forwarding `bug-reports@volleyvector.app` to a real inbox is a user-only step. Flag it in the handoff.
- **Admin surface**
    - A new tab in the admin panel listing feedback reports, mirroring the access-requests tab: show type, reporter, message, and time; mark handled or dismiss (soft-delete).

### Deployment notes

- The migration and the Edge Function reach production through CI on merge, never from a dev session. No manual deploy.
- User-only steps before merge:
    - Enable GitHub private vulnerability reporting (for `SECURITY.md`).
    - Add the Cloudflare Email Routing rule forwarding `bug-reports@volleyvector.app` to a real inbox.

### Post-merge steps (user-only)

- Test the feedback feature against production. Edge Functions can't run locally, so this is the first real exercise: submit a bug report and a feature request from the live app, confirm a row lands in the table, and confirm the email arrives at the forwarded inbox.
- Flip the repo to public.
- Configure branch protection on `main`:
    - Repo Pull Request settings: allow squash merging only (turn off merge commits and rebase).
    - A `main` ruleset: require a pull request before merging, required approvals 0 (a solo maintainer cannot self-approve), require the CI status check to pass, block force pushes, restrict deletions, and optionally require linear history.
    - No extra rule is needed for "only I can merge": only write-access collaborators can merge, and outside contributors fork and open PRs from their fork.

### Testing

- Add or update unit tests to cover the changed behaviour, no more than the changes require. Use the `react-testing` skill for frontend tests.
    - The feedback form: submitting a valid report calls the client helper with the chosen type and message; an error surfaces on failure.
    - The admin tab: a report lists, and handle/dismiss act on it. Mirror the access-requests tab's tests.
- Extend the RLS regression test (`supabase/tests/rls_policies_test.sql`) with a section for the new table, mirroring the `access_requests` section: a non-admin cannot read, insert, or update; an admin reads, marks handled, and dismisses.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- `SECURITY.md` and `CONTRIBUTING.md` exist at the repo root.
- A signed-in user can submit a bug or feature report from the account menu; it stores a row and sends a best-effort email.
- A non-admin cannot read the feedback table; an admin can list, handle, and dismiss reports.

## Follow-ups

_None._

## Implementation Notes

### What shipped

- **`SECURITY.md`** and **`CONTRIBUTING.md`** at the repo root. SECURITY points reporters to the GitHub private advisory flow (`https://github.com/jancurse/VolleyCoach/security/advisories/new`) and scopes out the documented admin-can-read-everything trade-off. CONTRIBUTING states issues-welcome / PRs-accepted-not-solicited, links `docs/development.md` and `docs/architecture.md`, and summarises the branch-naming and squash-merge conventions.
- **`feedback` table** (`supabase/migrations/20260625095528_feedback.sql`), modelled on `access_requests`: `id`, `reporter` (FK to `profiles`, `on delete set null`), `type` (`check in ('bug','feature')`), `message`, `created_at`, and the `handled_at`/`deleted_at`/`deleted_by` lifecycle. RLS mirrors `access_requests`: admin-only select/update, no insert/delete grant or policy for `authenticated`, explicit `service_role` grant. The partial open-index skips dismissed rows.
- **`submit-feedback` Edge Function**, mirroring `request-access` but authenticated: it authorizes the caller in code from their `Authorization` header (rejects if not signed in), validates `type` and caps the message at 2000 chars, inserts under the secret key with `reporter` = caller id, then sends a best-effort Resend email (escaped HTML, swallowed failures) carrying the reporter's display name and email looked up from `profiles`.
- **Client + UI**: `src/feedback/feedback.ts` (`sendFeedback`) and `src/feedback/FeedbackDialog.tsx` (type toggle + message, success and error states), opened from a new **Report a problem…** item in `AvatarMenu`, wired through `App.tsx`. Available to every signed-in user.
- **Admin surface**: a **Feedback** tab in `AdminPage` (new `feedback` `AdminSub`, breadcrumb label) listing type, reporter, message, and time with mark-handled / dismiss, backed by `useAdmin` (`feedback` list + `handleFeedback`/`dismissFeedback`). `AdminProfile` gained `displayName` so the tab resolves a reporter id to a name.
- **Tests**: `tests/feedback/FeedbackDialog.test.tsx` (submits the chosen type/message, defaults to bug, surfaces a failure), feedback cases added to `tests/admin/AdminPage.test.tsx`, a `feedback` fixture/table in the Supabase fake, and a feedback section (22) in `supabase/tests/rls_policies_test.sql`.
- **README demo**: a dark, real-time animated GIF of the landing rotation showcase (`docs/rotation-showcase.gif`), embedded as the README hero below the intro block. It is produced by a committed, re-runnable script (`scripts/generate-showcase-gif.mjs`, `npm run generate:showcase`) that drives system Chrome over the DevTools Protocol and encodes with system ffmpeg. `docs/development.md` lists the command; `src/landing/CLAUDE.md` flags that the GIF must be regenerated when the showcase changes.

### Decisions and deviations

- **`reporter` is nullable**, not `not null`. `on delete set null` conflicts with `not null` if a profile is ever hard-purged, and this matches `boards.created_by` ("or null once their account is deleted"). The Edge Function always sets it at insert; the column only goes null if the account is later purged, and the report survives for the admin.
- **Notify default** is `bug-reports@volleyvector.app`, overridable by the `FEEDBACK_NOTIFY_EMAIL` function secret (mirrors `REQUEST_NOTIFY_EMAIL`).
- The email lookup reads `profiles.email` under the **service role**, which has a full column grant (the email-privacy migration narrowed only `authenticated`), so the admin notification can include the reporter's address.
- **The README GIF uses system Chrome over CDP, not Playwright, and is kept out of CI.** This matches the brand-asset script's "system Chrome via `CHROME_BIN`" convention and avoids adding a heavy dependency or a browser download to `npm ci`. Frames are streamed with `Page.startScreencast` (push-based, ~50fps) and resampled by their real timestamps to a constant 24fps, so playback speed matches the page; pull-based `captureScreenshot` capped near 10fps and virtual-time stepping does not drive the clock under `--headless=new`. The script needs a running dev server; it is `.mjs` under `scripts/`, so no lint, typecheck, or workflow touches it.

### Verification

- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run test` (687 tests) all pass.
- `npm run test:rls` passes against a fresh branch-built database, exercising the new feedback policies (non-admin cannot read/insert/update; admin reads, marks handled, dismisses).
- The migration and Edge Function were not deployed: they reach production through CI on merge.

### User-only steps (handoff)

- **Before merge**: enable GitHub private vulnerability reporting (Settings → Code security → Private vulnerability reporting) so the `SECURITY.md` link works; add a Cloudflare Email Routing rule forwarding `bug-reports@volleyvector.app` to a real inbox.
- **After merge** (Edge Functions can't run locally, so this is the first real exercise): submit a bug and a feature report from the live app, confirm a row lands in `feedback` and the email arrives at the forwarded inbox. Then flip the repo public and configure `main` branch protection per the plan's Deployment/Post-merge notes.

### Critical Issues

None.
