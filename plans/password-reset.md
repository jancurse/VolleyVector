# Self-service password reset

## Implementation Agent Instructions

- **Role**: Full-stack engineer (React auth surfaces + a Supabase Edge Function), comfortable with the app's invite/Resend pattern.
- **Task**: Add a self-service "Forgot password?" flow: a request screen, a Resend-delivered recovery email minted by a new Edge Function, and a recovery landing that sets a new password.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code that matches the surrounding auth surfaces.
    - Load the `supabase` skill before any work under `supabase/`.
    - Reuse, don't duplicate: the new screens share structure with `SetPassword.tsx`, and the Edge Function mirrors `send-invite`.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - `src/auth/useAuth.tsx`, `src/auth/Login.tsx`, `src/auth/SetPassword.tsx` — the auth gate, sign-in, and the password-setting screen this reuses.
    - `src/App.tsx` — the gate precedence (`if (!user) return <Login/>`, then `SetPassword`, then `NameSetup`).
    - `supabase/functions/send-invite/index.ts` — the exact Resend + oracle-safe + rollback pattern to mirror.
    - `src/invites/invites.ts` — the shared `invokeFunction` Edge-Function client helper.
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects — do not implement them. If you uncover unplanned out-of-scope work, add it there. Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message as `- [ ] <item>`.

## Plan

### Goals

- A user who forgets their password recovers it without admin intervention.
- The recovery email is sent through the existing Resend sender, via a new Edge Function, with the email template in the repo — no Supabase Auth SMTP configuration.
- The request side leaks no account-existence information (oracle-safe), matching the app's existing sharing/invite philosophy.

### Non-goals

- No email verification at signup, and no change to how account emails are set. Unverified emails are accepted as-is (see Follow-ups).
- No "change password while signed in" control on the account page (see Follow-ups).
- No new database tables: recovery uses Supabase's own recovery token via `auth.admin.generateLink`.

### Design

The flow has three parts: a request screen, an Edge Function that mints and sends the link, and a recovery landing.

#### Request side

- **Entry point.** `Login.tsx` gains a quiet "Forgot password?" affordance. Selecting it shows the request screen in place of the sign-in form, both within the unauthenticated gate (`App` still renders `<Login/>` while `!user`). A "Back to sign in" affordance returns.
- **Request screen** (`src/auth/ForgotPassword.tsx`). One email field and a submit. On submit it calls a client helper that invokes the new Edge Function, then shows a neutral confirmation regardless of outcome: "If an account exists for `<email>`, we've sent a reset link." Reuse the gate layout/`PANEL` styling from `Login`/`SetPassword`.
- **Client helper.** Add a `requestPasswordReset(email)` helper (e.g. in `src/supabase/`) that invokes the function through the shared `invokeFunction` pattern in `src/invites/invites.ts`. The UI shows the same neutral confirmation on completion; it never branches on whether an account matched.

#### Edge Function (`supabase/functions/request-password-reset/`)

Mirror `send-invite` in shape (Resend API call, in-repo HTML/text template, the `APP_URL` constant, oracle-safe handling).

- POST `{ email }`. Normalise the email like `send-invite` (`trim().toLowerCase()`).
- Mint the recovery link server-side with the service-role admin client: `auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: APP_URL } })`.
- When the email has an account, email its `action_link` via the Resend API (`from: "VolleyVector <noreply@volleyvector.app>"`) with an in-repo recovery template (subject/html/text), reusing the existing `RESEND_API_KEY` function secret.
- **Oracle-safe by construction.** Return a uniform success whether or not an account matched, and whether or not the send succeeded: a missing account (`generateLink` errors with "user not found") and a send failure both return the same response as a success. Log failures server-side.
- Deploys under the same `--no-verify-jwt` rule as the other functions (the caller is unauthenticated — they have forgotten their password). It reaches production through the existing `deploy-functions.yml` on merge.

#### Recovery landing

- **Detection.** Supabase's recovery link redirects to `APP_URL`; supabase-js consumes the token from the URL and fires a `PASSWORD_RECOVERY` event. Handle it in `useAuth`'s existing `onAuthStateChange` listener: set a `recovering` flag on the auth context and expose a `clearRecovery()` to drop it. This needs no new path/hash route and does not collide with the `#/share`-style hash links.
- **Gate.** In `App.tsx`, when `recovering` is set, render the recovery screen ahead of the normal shell (the recovery event establishes a real session, so `user` is set — place the check among the post-`Login` gates, taking precedence over `SetPassword`/`NameSetup`).
- **Recovery screen.** Collects a new password and confirmation and calls the existing `updatePassword` (`useAuth`), with the same min-length and confirm-match validation as `SetPassword.tsx`. On success it calls `clearRecovery()` and continues into the app (the user is now signed in with the new password). Reuse `SetPassword`'s structure rather than copy it: parameterise its copy (title/description/button) or extract a shared password-setting screen — do not duplicate the form. Keep one component per file.

### Constraints

- No new tokens table or DB migration: recovery uses Supabase's built-in recovery token via `generateLink`.
- No Supabase Auth SMTP configuration: the email is sent by the Edge Function through Resend, like invites.
- Take every dimension/colour/style value from `src/ui/styles.ts` tokens and the `src/ui/` wrappers, as the existing auth screens do.

### User-only steps

The implementer must guide the user through these (they cannot be done from code):

- **Verify the recovery redirect is allow-listed.** Confirm `APP_URL` (`https://volleyvector.app`) is in Supabase Auth's redirect allow-list so the recovery link resolves back to the app. The production URL is already registered for login/share/invite, so this is a verification, not a new setup.
- **Confirm `RESEND_API_KEY` is set** as a function secret (already set for `send-invite`); no new secret is needed.
- The function reaches production by merging (CI deploys all functions). No manual deploy.

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill for frontend tests.

- `ForgotPassword`: submitting shows the neutral confirmation, and the UI does not branch on account existence (same confirmation for any email).
- The recovery screen: too-short and mismatched passwords are blocked client-side (mirroring `SetPassword`), and a valid submit calls `updatePassword`.
- `Login`: the "Forgot password?" entry is present and reveals the request screen.
- The `PASSWORD_RECOVERY` → `recovering` gate, if it can be driven through the existing Supabase test fake; otherwise document the manual verification.
- The Edge Function has no test harness (consistent with `send-invite`/`redeem-invite`): document the manual verification in Implementation Notes.

### Acceptance Criteria

- All tests pass (`npm run test`).
- All diagnostics pass (use the `diagnostics` skill): format, lint, and typecheck are clean.
- "Forgot password?" on the login screen sends a Resend email (via the new function) containing a working recovery link, and the request side reveals nothing about account existence.
- Clicking the link lands the user on the recovery screen; setting a new password signs them in and lets them use it.
- No Supabase Auth SMTP was configured, and no new DB migration was added.

## Follow-ups

- [ ] **Improve account-email correctness.** Both signup paths (`InviteAccept`) take a user-typed, unverified email, and accounts are created `email_confirm: true` without verification, so a wrong email locks the user out of reset until an admin fixes it in the dashboard. Options when warranted: a confirm-email field at signup, showing/editing the email on the account page, or full email verification (likely once off the Resend free tier).
- [ ] **Change password while signed in.** A "Change password" control on the account settings page for a logged-in user who knows their current password.

## Implementation Notes

### What was built

- **Edge Function** `supabase/functions/request-password-reset/index.ts`. Mirrors `send-invite`'s shape (CORS, `json`, in-repo Resend template, `APP_URL`) and reuses `redeem-invite`'s `privilegedKey()` to read the secret key. POST `{ email }`, normalised `trim().toLowerCase()`. Mints `auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: APP_URL } })` and emails its `action_link` through Resend from `noreply@volleyvector.app`, reusing `RESEND_API_KEY`. **Oracle-safe by construction:** a missing account (generateLink errors / no link) and a send failure are both logged with `console.error` and return the same `{ ok: true }` as a real send. Only a malformed request (bad JSON, missing email) or a server-misconfig returns a non-200.
- **Client helper** `src/supabase/passwordReset.ts`: `requestPasswordReset(email)` invokes the function through the shared `invokeFunction`. It returns `Promise<void>` — there is deliberately no outcome to branch on, so the UI cannot leak account existence.
- **Request side.** `Login.tsx` gained a quiet "Forgot password?" affordance (the same muted-underline style as SetPassword's sign-out escape) that swaps the sign-in form for `ForgotPassword.tsx` in place; App still renders `<Login/>` while `!user`. `ForgotPassword.tsx` takes an email, calls the helper, and shows one neutral confirmation regardless of outcome ("If an account exists for `<email>`, we've sent a link…"), with a "Back to sign in" affordance.
- **Recovery landing.** `useAuth` now exposes `recovering` + `clearRecovery()`, set from a `PASSWORD_RECOVERY` event in the existing `onAuthStateChange`. The listener is now subscribed **before** the first `getSession()` (which is what consumes the recovery token from the URL), because the event only reaches listeners already registered when supabase-js fires it. `App.tsx` renders the recovery screen when `recovering` is set, ahead of the invite `SetPassword` and `NameSetup` gates. No new path/hash route; recovery's `type=recovery` hash does not collide with `#/share`-style links or `isInviteLanding` (`type=invite`).
- **Shared form, no duplication.** Extracted `NewPasswordForm.tsx` (the panel form: two password fields, the min-length/confirm-match validation, `updatePassword`, and the sign-out escape). `SetPassword.tsx` and the new `ResetPassword.tsx` are thin wrappers supplying only their copy and `onDone`. One component per file.

### Testing

- Unit tests added: `tests/auth/ForgotPassword.test.tsx` (neutral confirmation identical for an existing vs non-existing email, email trimmed, request shape recorded; back-to-sign-in), `tests/auth/ResetPassword.test.tsx` (too-short and mismatched blocked client-side; a valid submit calls `updatePassword` and finishes), `tests/auth/Login.test.tsx` ("Forgot password?" reveals the request screen and returns).
- Full suite green (`npm run test`: 638 passed). Diagnostics clean (format, lint, typecheck).
- **Not unit-tested (documented manual verification):**
    - The `PASSWORD_RECOVERY` → `recovering` gate. The Supabase test fake's `onAuthStateChange` returns a static subscription and never emits events, so the event path is not drivable through it without expanding the fake (out of scope). Verify manually: request a reset on the live app, click the email link, confirm the recovery screen shows and the new password signs you in.
    - The Edge Function has no test harness, consistent with `send-invite`/`redeem-invite`. Verify manually after it deploys (on merge): a request for a real account delivers an email with a working link; a request for an unknown address returns the same response and sends nothing (check function logs for the `console.error` line, not a different HTTP response).

### User-only steps status

Pending the user (see "User-only steps"): (1) verify `https://volleyvector.app` is in Supabase Auth's redirect allow-list (already there for login/share/invite — a check, not new setup); (2) confirm `RESEND_API_KEY` is set as a function secret (already set for `send-invite`). The function reaches production by merging; no manual deploy. I will guide these.

### Critical Issues

None. All acceptance criteria are met in code and tests; the two manual verifications above and the user-only steps remain.
