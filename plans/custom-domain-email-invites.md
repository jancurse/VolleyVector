# Custom domain, transactional email, and email invites

## Implementation Agent Instructions

- **Role**: Full-stack engineer comfortable with Cloudflare Pages, Supabase Auth (custom SMTP), DNS, and the app's React invite UI.
- **Task**: Move production to the custom domain `volleyvector.app`, send authenticated transactional email from it via Resend, and re-enable the "By email" invite path in `InviteDialog`.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - The code changes are small and mechanical (URL/project-name strings, one dialog path). The weight of this task is the user-only infrastructure steps: guide the user through them in order, one at a time, and do not declare done until the end-to-end checks pass (use the `user-steps` skill).
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @docs/architecture.md (the "Deployment and operations" section)
    - @docs/development.md (the "Deployment and the database pipeline" section)
    - `src/team/InviteDialog.tsx`, `src/supabase/invite.ts`, `supabase/functions/invite/index.ts`
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. If you uncover unplanned work that belongs in its own future project, add it there. Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Goal

Replace the free `volleycoach.pages.dev` host with `volleyvector.app`, a domain we control, so we can send authenticated, deliverable transactional email from it without Supabase's built-in-sender rate limit, and turn the email invite path back on.

Three workstreams, each ending at production:

1. **Custom domain** on a new Cloudflare Pages project, with the old subdomain 301-redirecting to it.
2. **Transactional email** from the domain via Resend, wired into Supabase Auth as custom SMTP.
3. **Email invites** re-enabled in the UI.

### Decisions (fixed)

- **Domain**: `volleyvector.app`, registered through **Cloudflare Registrar** (DNS, Pages, and email records all in one account).
- **Email provider**: **Resend**, as Supabase Auth custom SMTP.
- **Pages project**: a **new** project named `volleyvector` becomes production; `deploy.yml` points at it. The existing `volleycoach` project is **kept**, serving only a 301 redirect from `volleycoach.pages.dev` to `volleyvector.app` so old links keep working. (Cloudflare can't rename a project in place, hence the new project rather than an in-place rename.)

### Structure: group the user-only steps

Most of this task is infrastructure only the user can do (registrar, Cloudflare, Resend, Supabase dashboards). The code changes are small. To avoid stopping repeatedly, the work is grouped into three phases: **all provisioning up front**, **all code in the middle (no stops)**, **cutover + verification at the end**.

#### Phase 1 — Provision (user-only, up front)

Done before any code lands; nothing here depends on the code. The new domain exists but serves nothing until Phase 3 (expected).

1. **Register the domain.** Register `volleyvector.app` via Cloudflare Registrar, so its DNS zone lives in the Cloudflare account.
2. **Create the new Pages project.** Create a Cloudflare Pages project named `volleyvector` (Direct Upload, production branch `main`). Leave it empty. It must exist before the deploy workflow targets it and before a domain can attach.
3. **Attach the custom domain.** Add `volleyvector.app` (apex only) as a custom domain on the `volleyvector` project. It 404s until the first deploy in Phase 3 — expected.
4. **Set up Resend.** Create a Resend account, add and verify the `volleyvector.app` domain, and add the DNS records it gives you (DKIM/SPF/DMARC, plus any sending-subdomain MX for the Return-Path) into Cloudflare DNS. Create an API key. The verified sender is `noreply@volleyvector.app`.
5. **Configure Supabase Auth custom SMTP.** In the Supabase dashboard, enable custom SMTP pointing at Resend (host `smtp.resend.com`, the SMTP port, username `resend`, password = the Resend API key, sender `noreply@volleyvector.app`, sender name `VolleyVector`). Raise the auth email rate limit off the built-in-sender default. Add `https://volleyvector.app` to the **Site URL** and the **redirect allow-list** (keep `volleycoach.pages.dev` listed through the transition).
6. **Set the invite redirect secret.** Set the Edge Function secret `INVITE_REDIRECT_URL=https://volleyvector.app/` so the invite email's link lands on production. (Function secrets are a manual dashboard/CLI step, never CI.)

#### Phase 2 — Code (agent, no stops)

All small and mechanical; no user interaction needed.

- `.github/workflows/deploy.yml`: `--project-name=volleycoach` → `--project-name=volleyvector`.
- `index.html`: `og:url` and `og:image` absolute URLs → `https://volleyvector.app/…`.
- `docs/architecture.md` and `docs/development.md`: production URL → `https://volleyvector.app`, project name → `volleyvector`, and note the custom domain plus the old-subdomain 301 redirect.
- `src/team/InviteDialog.tsx`: restore the "By email" path (see below). Add/adjust tests.
- The plan file is committed on the branch and deleted in a separate commit before the squash-merge.

#### Phase 3 — Cutover and verify (user, after merge)

1. **Merge the PR.** CI-gated. On merge, `deploy.yml` publishes the build to the **new** `volleyvector` project, so `volleyvector.app` goes live. (The function redeploy on merge is a harmless no-op for the unchanged `invite` function.)
2. **Verify the app on the new domain.** `https://volleyvector.app` loads; a share/invite deep link resolves through the SPA fallback.
3. **Redirect the old subdomain.** Deploy a one-time redirect build to the **old** `volleycoach` project: a `dist` whose `_redirects` is `/*  https://volleyvector.app/:splat  301` (a one-off `wrangler pages deploy --project-name=volleycoach`). The deploy workflow never touches the old project again, so this redirect stays. Verify `volleycoach.pages.dev/*` 301s to `volleyvector.app`.
4. **Test an email invite end-to-end.** Invite → By email → a real address → confirm Resend shows it sent and the inbox receives it, then the recipient sets a password and joins.
5. **Cleanup (optional).** Once stable, drop `volleycoach.pages.dev` from the Supabase redirect allow-list.

### 3. Re-enable the email invite path

The `invite` Edge Function and the `inviteMember` client helper already exist and are unchanged; only the UI entry was removed (commit `625e286`). Since then `InviteDialog` was rewritten (commit `a6ad330`) into a link-minting dialog, so this is **not** a git revert — the email path is re-integrated into the current dialog.

- **Behaviour of the email path**: collect an email address, a team, and a role, then call `inviteMember(email, teamId, role)`. The server creates the account if new, emails the invite, and adds the membership. It always targets a team (the function requires `teamId`) and creating an account consumes invite quota for a non-admin, exactly like a "New person" link.
- **Proposed placement**: a top-level method toggle **By link** / **By email**.
    - **By link** keeps the current dialog unchanged (link-type toggle, team/role, bonus invites, "Create invite link").
    - **By email** shows an email input, the team picker (required; when the dialog is team-scoped the team is fixed), and the role, with a "Send invite" button and a sent/error status. It is gated by the same invite-quota check as a new-person link, and disabled with a note when no team is selected.
- Keep the `inviteMember` error-surfacing behaviour already in `src/supabase/invite.ts`.

### Testing

Add or update unit tests for `InviteDialog` covering the "By email" path: it calls `inviteMember` with the entered email, selected team, and role, shows the sent confirmation on success and the returned error on failure, and is disabled without a team or without invite quota. Use the `react-testing` skill. No tests for the infrastructure steps (they are external).

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- `https://volleyvector.app` serves the app over HTTPS, and `volleycoach.pages.dev/*` 301-redirects to it.
- A transactional email (an email invite) sent from the app is delivered from `volleyvector.app` via Resend, with no rate-limit error.
- The "By email" option is back in `InviteDialog` and successfully invites a new member end-to-end.
- No `volleycoach.pages.dev` or `--project-name=volleycoach` references remain in code or docs (the redirect target excepted).

## Follow-ups

- **Add a DMARC record for the sending domain.** Resend's Cloudflare auto-config set up SPF and DKIM only. Add a `_dmarc.volleyvector.app` TXT record (starting at `v=DMARC1; p=none;` for monitoring, optionally with an `rua=` reporting address) to complete email authentication and improve long-term deliverability. Not required for sending to work.
- **Re-implement email invites on the link/quota machinery**, replacing the dead `invite` function the shipped path wrongly uses, so a quota slot drops only when the email actually sends. Plan: `plans/email-invites-on-links.md`.

## Implementation Notes

### Phase 1 — Provision (user)

Phase 1 (provisioning, detailed in the Phase 1 section above) was completed by the user before this change. These are external steps with no code artifact in this repo.

### Phase 2 — Code

- **Mechanical string changes, as planned.**
    - `.github/workflows/deploy.yml`: deploy command now targets `--project-name=volleyvector`.
    - `index.html`: `og:url` and `og:image` point at `https://volleyvector.app/`.
    - `docs/architecture.md` and `docs/development.md`: production host is the `volleyvector` project at `volleyvector.app`, with a note that the old `volleycoach.pages.dev` 301-redirects to it. The two remaining `volleycoach.pages.dev` mentions are exactly that redirect source, which the acceptance criteria except.
- **`src/team/InviteDialog.tsx` — the "By email" path.**
    - A top-level **Invite by** toggle (`By link` / `By email`) gates the body. By link is the prior dialog unchanged; by email shows an email input and reuses the existing team/role pickers, then calls the unchanged `inviteMember(email, teamId, role)`.
    - The two in-flight booleans (`creating`, plus a new send flag) were unified into one `busy` flag, since only one method runs at a time. `sent` holds the address string so the confirmation can name it, and `error` is shared (cleared on method switch and on each action).
    - Quota gating reuses `canCreateAccount` (the same check as a "New person" link). The email Send button is disabled without invite quota or without a selected team, each with a note; `quotaNote` was generalized so it also shows in email mode.
    - The team/role picker block and its team-scoped behaviour (team fixed when the dialog is opened from a team) are shared between both methods unchanged; **Bonus invites** stays link-only.
- **Tests** (`tests/team/InviteDialog.test.tsx`): the By email path sends to the entered address, selected team, and role and shows the sent confirmation on success and the returned error on failure; Send is disabled (and never calls the function) without a team or without invite quota. The Supabase client is the only mock.
- **Verification**: `npm run test` (591 pass), `npm run lint`, `npm run typecheck`, and `npm run build` all pass.

### Phase 3 — Cutover and verify (user, after merge)

_Not yet implemented._

### Critical Issues

The email invite path does not deliver the plan's requirement that creating an account by email consume invite quota like a "New person" link. The shipped UI calls the `invite` Edge Function, which bypasses the `invites`/quota machinery, so a non-admin's quota is not consumed and the email Send button's quota gating is client-side only. The rework is planned in `plans/email-invites-on-links.md` (also listed under Follow-ups).
