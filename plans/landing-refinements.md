# Landing Page Refinements

## Implementation Agent Instructions

- **Role**: Frontend engineer comfortable across the React client, Supabase migrations, RLS, and Edge Functions.
- **Task**: Refine the logged-out landing page: trim repeated sign-in/invite messaging, add an invite-aware access action, let invite links land on the page, and add a no-account "Try it" sandbox.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - Reuse existing surfaces (`BoardView`, `BoardEditor`, `ExportMenu`, `PrintView`, `InviteAccept`, `LoginForm`) rather than duplicating them.
    - Every new control renders through `src/ui/` wrappers and shared tokens.
    - The "Try it" sandbox must never read from or write to Supabase.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @src/landing/LandingPage.tsx, @src/landing/SignInModal.tsx, @src/landing/HeroBoard.tsx, @src/landing/demoBoard.ts
    - @src/App.tsx (logged-out routing, invite/grant/share gates, print routes)
    - @src/invites/InviteAccept.tsx, @src/invites/useInviteRoute.ts, @src/invites/invites.ts
    - @src/auth/LoginForm.tsx (the `surface` overlay pattern to mirror)
    - @src/bundle/ExportMenu.tsx, @src/print/PrintView.tsx, @src/print/BoardPrint.tsx
    - @src/admin/AdminPage.tsx, @src/admin/useAdmin.ts
    - @supabase/functions/send-invite/index.ts (Resend + caller-auth pattern)
    - @docs/architecture.md (access control, deletion/recovery, deployment sections)
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` per its section description.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task. Re-read the section before declaring done and restate every item verbatim in your final message. If it is `_None._`, write `Follow-ups: none.`

## Plan

### Open Issues

_None._

### Goals

- Reduce duplicated sign-in and "invite-only" messaging on the landing page.
- Give a logged-out visitor one clear access action that adapts to whether they arrived with a valid invite.
- Let an invite link show the landing page first, then accept, instead of replacing the screen with a bare form.
- Let anyone build a board on the landing page without an account, and export it (JSON and PDF) exactly as in-app.

### Non-goals

- No change to the signed-in app shell, the board/note model, or existing access-control rules.
- No public sign-up: account creation still happens only through the invite flow.

### Requirements

#### Landing page messaging cleanup

- Sign-in is offered from the header only. Remove the hero's "Sign in" call to action and its "Invite-only. Sign in to pick up your boards." line.
- The hero's primary call to action becomes **Try it** (see the sandbox section).
- Remove the footer "Invite-only" tag and any other standalone "invite-only" repetition. Invite-only context now lives only in the Request-access flow.

#### Invite-aware access action (header)

- The header carries the existing theme toggle, a **Sign in** action, and a second access action whose label and behaviour depend on the invite state:
    - **No invite token, or an invalid/expired one** → **Request access**, opening the express-interest dialog below.
    - **A valid invite token** → a highlighted **Accept invite** action, plus a short banner naming what the link offers (e.g. the team and role), opening the invite-accept flow.
- The invite state is resolved from the URL hash token (`useInviteRoute`) via `invitePreview`. While the preview is resolving, show a neutral state; on an invalid result fall back to **Request access**.

#### Invite links land on the page

- A logged-out visitor opening `#/invite/<token>` sees the landing page (with the Accept-invite affordance above), not the bare full-screen `InviteAccept`.
- Accepting opens the existing `InviteAccept` flow in a modal floated over the landing page, matching the Sign-in modal pattern. `InviteAccept` gains an overlay surface variant (mirroring `LoginForm`'s `surface` prop) so the same component serves both the full-screen and modal cases.
- A signed-in visitor opening an invite link keeps today's behaviour (one-click claim); only the logged-out path changes.
- Share links and grant links are unchanged.

#### Request access (express interest)

- The Request-access dialog explains the app is invite-only and offers two paths: ask a coach or admin for an invite link, or submit interest here.
- The interest form collects an email (required) and an optional message, and submits without an account.
- A submission is **recorded** as the source of truth, with a **best-effort email notification** on top:
    - New table for access requests (email, optional message, created-at, a handled/seen state, and soft-delete fields consistent with the rest of the schema). The stored row is the source of truth surfaced in the admin panel.
    - RLS: admins may read and update; the row is written only by the server (service role) via the Edge Function, never by an ordinary client. Extend the RLS regression test (`supabase/tests/rls_policies_test.sql`) to cover the new table.
    - A new public Edge Function (no JWT) validates the email, inserts the row via service role, then sends a notification email through Resend (reuse the `send-invite` email/Resend conventions). The notification is best-effort: a failed send must not fail the request or lose the stored row. The function returns a non-revealing success regardless of outcome.
    - The notification recipient is configurable via an Edge Function secret, defaulting to `jan.corsten92+volleyvector-request@gmail.com`.
- The admin panel gains a **Requests** view listing submissions, with an action to mark a request handled and to dismiss it. Wire it into `AdminPage`/`useAdmin` alongside the existing admin sections.

#### "Try it" sandbox (no account)

- Reachable while logged out from the hero **Try it** action, addressable by a hash route so a refresh keeps it.
- On entry, the visitor chooses to start from the **sample** play (the existing `demoBoard`) or a **blank** board.
- The sandbox renders the real view/edit experience (`BoardView` + `BoardEditor`) against an in-memory board. Editing and committing update local state only — nothing is read from or written to Supabase.
- Export matches the in-app board actions: Copy/Download JSON and **Print… → PDF**. Because the print routes resolve boards by id from the loaded library, the sandbox renders the transient board through `PrintView`/`BoardPrint` from local state instead of the id-based print route.
- A clear way to leave the sandbox and return to the landing page.

### Constraints

- The new migration and Edge Function reach production only through the CI-gated pipeline on merge (see @docs/architecture.md). Setting the Resend recipient/secret is a manual, user-only step.
- Follow the mandatory `supabase` skill for any Supabase work, and the `frontend-design` skill for new UI.

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill for frontend tests.

- Landing page: header shows Sign in + the invite-aware access action; hero shows Try it; removed messaging is gone.
- Invite-aware action: Request access without a token; Accept invite + banner with a valid preview; fallback to Request access on an invalid preview.
- Request-access dialog: submitting calls the function with the email and optional message.
- "Try it": entering from the hero, choosing sample vs blank, and that export actions are available; no Supabase calls occur.
- Extend the RLS regression test for the new access-requests table.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- A logged-out visitor sees sign-in only in the header, no duplicated invite-only copy, and a Try it hero action.
- An invite link shows the landing page with an Accept-invite affordance and banner, and accepting completes through the existing flow.
- Request access emails the recipient and records a row an admin can see in the panel.
- The Try it sandbox builds and exports a board (JSON and PDF) without any account or backend write.

## Follow-ups

_None._

## Implementation Notes

Implemented across all five areas. Diagnostics (format, lint, typecheck, build), the full Vitest suite (612 tests), and the RLS regression test (`npm run test:rls`, built from this branch's migrations) all pass.

### Landing messaging + invite-aware header (`src/landing/LandingPage.tsx`)

- The hero's primary CTA is now **Try it** (opens the sandbox); its old Sign-in button and the "Invite-only. Sign in to pick up your boards." line are gone, replaced by a quiet "No account needed" clarifier. The footer's standalone "Invite-only" tag is removed.
- The header keeps the theme toggle and a **Sign in** action (now `ghost`, opening the existing `SignInModal`), plus one access action driven by the invite state:
    - No token, still resolving, or spent/invalid → quiet **Request access** (opens `RequestAccessDialog`).
    - A valid preview → highlighted **Accept invite** plus a slim accent banner naming the team and role; both open the accept modal.
- Invite state resolves through a new reusable hook `src/invites/useInvitePreview.ts` (`useInviteRoute` token → `invitePreview`). It resets to the neutral state during render (not in an effect) to satisfy `react-hooks/set-state-in-effect`.

### Invite links land on the page (`src/App.tsx`, `src/invites/InviteAccept.tsx`, `src/landing/InviteModal.tsx`)

- `App` now gates the full-screen `InviteAccept` on `user`: a signed-in visitor still gets the one-click claim; a logged-out visitor falls through to `LandingPage` (passed the `inviteToken`), which floats the same flow in `InviteModal` over the hero.
- `InviteAccept` gained a `surface?: "panel" | "overlay"` prop mirroring `LoginForm`: `overlay` drops the full-screen background and renders the lifted overlay card, so one component serves both the gate and the modal. Share and grant links are untouched.

### Request access (express interest)

- **Migration** `supabase/migrations/20260623114800_access_requests.sql`: new `access_requests` table (`email`, `message`, `created_at`, `handled_at`, soft-delete `deleted_at`/`deleted_by`). RLS grants admins select/update only; there is no insert grant or policy for `authenticated`, so only the Edge Function's secret key writes. `service_role` is granted explicitly. The RLS regression test gained section 14 covering all of this (non-admin can't read/insert/update; admin reads, marks handled, dismisses).
- **Edge Function** `supabase/functions/request-access/index.ts` (public, no JWT): validates the email, inserts the row via the secret key (the source of truth), then sends a best-effort Resend notification (a failed send is swallowed, the request still succeeds). Returns a non-revealing `{ ok: true }`. Recipient defaults to `jan.corsten92+volleyvector-request@gmail.com`, overridable by the `REQUEST_NOTIFY_EMAIL` secret; it reuses the existing `RESEND_API_KEY`.
- **Client + UI**: `src/landing/requestAccess.ts` forwards to the function; `src/landing/RequestAccessDialog.tsx` explains the two paths (ask for a link, or submit interest) and collects email + optional message, swapping to a confirmation on success.
- **Admin panel**: `useAdmin` loads open requests and exposes `handleRequest`/`dismissRequest`; `AdminPage` adds a **Requests** tab listing email/message/date with "Mark handled" and "Dismiss". New `requests` admin sub wired through `routing/route.ts` and `shell/breadcrumb.ts`.

### "Try it" sandbox (`src/landing/Sandbox.tsx`, `src/landing/useTryRoute.ts`)

- Addressable at the `#/try` hash route (survives refresh), reachable while logged out and ahead of the auth gate in `App`. The hash is added to `App`'s `hashRoute` guard so the path router stays dormant.
- Holds one board in local state. A start chooser offers the sample `demoBoard` or a blank `createBoard`; the real `BoardView`/`BoardEditor` render against it, and committing updates local state only. Export reuses `ExportMenu` (Copy/Download JSON) plus a Print item that renders the transient board through `PrintView`/`BoardPrint` directly (the id-based print route can't reach an in-memory board). "Exit" clears the hash back to the landing page. A unit test asserts no Supabase reads/writes occur.

### Decisions / notes

- The sandbox's `BoardEditor` still writes its localStorage draft backup while editing. That is not Supabase and is harmless here (the app never opens an edit URL for the sandbox board ids), so it was left as-is rather than threading a "disable backup" flag through the shared editor.
- The message field in `RequestAccessDialog` uses `aria-label` on the shared `Textarea` (the codebase idiom, since the `Field` wrapper only auto-associates Base UI controls, not a plain textarea), with a visible `FIELD_LABEL` caption.

### Critical Issues

- None blocking. Two user-only follow-through items, both consistent with the existing pipeline:
    - The migration and the new Edge Function reach production only by merging the PR (CI-gated `migrate-prod.yml` / `deploy-functions.yml`); they were not pushed from here. `migration-guard.yml` will flag the PR.
    - The notification works in production with the existing `RESEND_API_KEY`. To change the recipient from the default Gmail address, set the `REQUEST_NOTIFY_EMAIL` function secret (`supabase secrets set`) — a manual, user-only step. Leaving it unset is fine.
