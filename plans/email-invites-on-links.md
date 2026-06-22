# Email invites on the invite-link machinery

## Implementation Agent Instructions

- **Role**: Full-stack engineer comfortable with Supabase Edge Functions, RLS and quota triggers, Resend transactional email, and the app's React invite UI.
- **Task**: Re-implement the email invite path so it reuses the existing invite-link and quota machinery and adds only email delivery, removing the dead `invite` function it currently uses.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - Do not bypass or duplicate the quota path: an email invite must mint a normal `invites` row and flow through the same trigger, redeem function, and accept screen as a link.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @docs/architecture.md (the "Backend and access control" section: sharing, invites, and quota)
    - `src/team/InviteDialog.tsx`, `src/invites/invites.ts`, `src/supabase/invite.ts`
    - `supabase/functions/invite/index.ts`, `supabase/functions/redeem-invite/index.ts`
    - `supabase/migrations/20260608000001_invites.sql`, `supabase/migrations/20260620121000_invite_quota.sql`
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. If you uncover unplanned work that belongs in its own future project, add it there. Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Goal

An email invite is a "New person" team link that is delivered by email instead of copied. It must share the invite-link path's mint, quota, redeem, and accept flow, and differ only in delivery. A quota slot is consumed only when the email is actually sent.

### Current state to replace

- The shipped email path (`InviteDialog` "By email") calls `inviteMember` → the `invite` Edge Function, which creates the account directly and adds the membership without ever inserting an `invites` row or checking quota. It bypasses the quota system entirely. This is the defect this plan removes.
- The invite-link path is the maintained, quota-correct machinery: `createInvite` inserts an `invites` row, `enforce_invite_quota` gates the mint, `invite_available` counts it, `redeem-invite` claims it and creates or joins the account, and `InviteAccept` at `#/invite/<token>` is the recipient screen. None of this changes.

### Requirements

- **Mint the same row as a link.** An email invite mints an `invites` row with `allows_new_account: true`, the chosen `team_id` and `role`, and `grant_quota: 0`: identical to a "New person" team link, so the quota trigger reserves a slot.
- **One user action.** A single click drives the whole email invite, and the browser makes a single call.
- **Slot consumed only on send.** If the email send fails, the just-minted invite row is removed and the slot released, and the failure is surfaced. A slot is reserved only when the email actually goes out.
- **Server-side custom email.** The email is sent server-side via Resend's API from the verified `noreply@volleyvector.app` sender, and contains the `#/invite/<token>` link plus the team and role context. Email credentials never reach the browser.
- **Unchanged recipient flow.** The recipient redeems through the existing `#/invite/<token>` → `invite_preview` / `InviteAccept` → `redeem-invite` path, which creates the account (or joins an existing user) and spends or releases the slot via `created_account`.
- **Remove the dead path.** Delete the `invite` Edge Function and the `inviteMember` client helper, and update any comment that names the `invite` function as an account-creation site (e.g. in `redeem-invite`). The "By link" path and `createInvite` are unchanged.
- **Keep the dialog's shape.** The `InviteDialog` "By email" UX stays as it is (email input, required team, role, quota gating like a New person link), but routes through the new server path. Remove the shipped version's false "spends a slot" comment and its no-op availability refetch.

### Server behaviour

A single Edge Function call performs, in order:

1. Authorize the caller from their own login: an admin, or a coach of the target team, matching the `invites` insert policy.
2. Mint the `invites` row **as the caller**, so the existing RLS insert policy and `enforce_invite_quota` trigger apply and quota is enforced (never via an unchecked service-role insert).
3. Send the email through Resend.
4. On send failure, delete the just-minted row to release the slot and return the error. On success, return success; the row is now an ordinary invite link.

### Configuration and user-only steps

- **`RESEND_API_KEY` Edge Function secret.** Set it in the Supabase dashboard or via `supabase secrets set` (a manual, user-only step, never CI), reusing the Resend account, verified domain, and key provisioned for the custom-domain work. The function sends from `noreply@volleyvector.app`.
- This feature depends on that Resend domain and key already existing.

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill for frontend tests.

- `InviteDialog` "By email": one action mints and sends through the new path; shows the sent confirmation on success and the returned error on failure; is gated by quota and a selected team like a New person link. Mock Supabase (and the new server call) as the external dependency.
- Edge Functions are not unit-tested in this repo; verify the mint, the send, the rollback-on-failure (no row persists, no slot consumed), and end-to-end delivery manually, as with the other functions.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- An email invite mints an `invites` row identical to a "New person" team link and is redeemed through the unchanged `#/invite/<token>` flow.
- A quota slot is consumed only when the email is sent; a failed send leaves no invite row and consumes no slot.
- The email is delivered from `noreply@volleyvector.app` via Resend with a working `#/invite/<token>` link.
- The `invite` Edge Function and the `inviteMember` helper are gone, and no code references them.

## Follow-ups

_None._

## Implementation Notes

### Server: the `send-invite` Edge Function

- New `supabase/functions/send-invite/index.ts`. Its only secret is `RESEND_API_KEY`; it holds no Supabase service-role key, because every database action runs **as the caller** under RLS.
- Flow per call: authorize the caller (admin, or coach of the team) for a clean 403; read the team name (caller-readable under `teams_select`); mint the `invites` row as the caller with `allows_new_account: true`, `grant_quota: 0`, the chosen `team_id`/`role` (so the `invites_insert` policy and `enforce_invite_quota` trigger gate it exactly as a copied "New person" link, and a quota-exhausted mint fails here before any send); send the email via Resend's HTTP API from `VolleyVector <noreply@volleyvector.app>`; on a non-2xx send, delete the just-minted row (releasing the slot) and return the error. The explicit authorize is the friendly message only — the mint's RLS is the real boundary, never a service-role insert.
- The email's link is `https://volleyvector.app/#/invite/<token>` (the canonical production host, hardcoded as `APP_URL`, matching the verified Resend sender and `index.html`'s OG URLs), and names the team and role. No new env beyond `RESEND_API_KEY`.
- No schema change: the function reuses the existing `invites` table, insert policy, quota trigger, `invite_preview`, `redeem-invite`, and `InviteAccept` unchanged. No migration, so the RLS test is untouched. The `deploy-functions.yml` loop deploys all functions, so `send-invite` ships on merge with no workflow edit.

### Client

- `src/invites/invites.ts`: added `sendEmailInvite(email, teamId, role)`, which calls the `send-invite` function. The private `callRedeem` was generalized to `invokeFunction(name, body)` (same error-surfacing that reads the function's HTTP body) and now backs both the redeem helpers and `sendEmailInvite`, so the extraction lives once.
- `src/supabase/invite.ts` (the `inviteMember` helper) and `supabase/functions/invite/` (the dead Edge Function) are deleted. No code references either.
- `src/team/InviteDialog.tsx`: the "By email" Send now calls `sendEmailInvite` instead of `inviteMember`; its dialog shape, quota gating, and team/role pickers are unchanged. Removed the shipped version's false "spends a slot" comment and its post-send `inviteAvailability` refetch, per the plan.

### Docs and comments

- `redeem-invite/index.ts`: dropped "or in the `invite` function" from the header, since `redeem-invite` is now the only account-creation site.
- `docs/architecture.md` (Auth, invites, and keep-alive): rewrote the email-invite bullet to describe the `send-invite` path (mint-as-caller, Resend send, slot-on-send, redeem through the link flow), and dropped the `invite` function from the "where accounts are born" sentence.

### Verification

- `npm run test` (591 pass), `npm run format`, `npm run lint`, `npm run typecheck`, and `npm run build` all pass.
- `InviteDialog.test.tsx` updated to expect the `send-invite` call (mint-and-send through the new path; sent confirmation on success; returned error on failure; Send disabled and never called without a team or without quota). Supabase is the only mock.
- Edge Functions are not unit-tested here. The mint, the Resend send, the rollback-on-failure (no row, no slot), and end-to-end delivery from `noreply@volleyvector.app` need manual verification after merge, once `RESEND_API_KEY` is set (a user-only Edge Function secret, never CI — see Configuration above).

### Critical Issues

_None._
