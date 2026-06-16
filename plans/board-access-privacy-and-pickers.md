# Board Access: Privacy and Picker Guidance

## Implementation Agent Instructions

- **Role**: Full-stack engineer working across the React client, Supabase RLS/RPCs, and the repo's docs and skills.
- **Task**: Stop personal data leaking to non-admins, replace the unbounded user picker in the access manager with a relationship-scoped one, add two ways to share outside your teams, and record the picker and privacy rules in the repo's guidance.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - Access and data-exposure rules are enforced server-side (RLS/RPC), never only in the client.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @docs/architecture.md (Backend and access control)
    - `src/sharing/AccessList.tsx`, `src/sharing/access.ts`, `src/sharing/AccessManager.tsx`, `src/sharing/NoteAccessManager.tsx`
    - `src/team/useMembers.ts`, `src/admin/useAdmin.ts`
    - `src/invites/`, `supabase/functions/redeem-invite/`
    - `supabase/migrations/` (the profiles RLS policy and `handle_new_user` trigger)
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. If you uncover unplanned work that belongs in its own future project, add it there. Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Goals

- No personal data (email, in particular) reaches a non-admin client.
- The access manager's "add a person" control is bounded by relationship, not the full accounts table.
- An owner can still share with someone outside their teams, without enumerating accounts or revealing emails.
- The repo records, for future work, how to choose a picker for a growing set and that personal-data exposure is reviewed.

### Stages

The work splits into four stages. They are an organizational split, not a build order — the whole plan ships together. (Stage 4's exact-email path relies on Stage 2's unique emails for correctness, but since both are in the same change there is no sequencing between them.)

#### Stage 1 — Guidance and process

- **Picker rule.** Add a rule to `docs/style_guide.md` under **UI Controls** describing the failure of revealing a whole growing set at once, and offering alternatives with when each helps. Do not frame the alternatives as exhaustive or as a forbidden-patterns list. Proposed text:
    > **Pickers over growing sets.** A control that reveals all its options at once fits a set that's small and bounded by design. When the set grows with the data (accounts, boards), that loads slowly, gives no way to narrow, and can expose more than the user should see. Ways to keep what's loaded bounded:
    > - **Scope to a relationship** (your teams, your teammates), where it makes sense — narrows to who's relevant rather than everyone. Sufficient on its own only when the result is bounded to a small number by design (not merely small today); otherwise combine it with one of the below.
    > - **Filter an already-loaded scoped set** — when it's dozens to low hundreds and instant typing helps.
    > - **Search server-side** (query with a limit, nothing shown until typed) — when the set is large or sensitive and the user can name the target.
    > - **A dedicated paginated page** — when the task is browse or manage, not pick-one.
- **Style-guide pointer.** Change the style-guide reference in `AGENTS.md` from the `@`-import form to a plain path, so the file is read on demand rather than auto-loaded into every context. Keep the instruction to read it before substantial code changes.
- **Code-review rule.** Extend the **Security** checklist item in `.claude/skills/code-review-custom/SKILL.md` so reviews check that personal data (emails and the like) never reaches a non-admin client — covering both what RLS/RPCs return and what the client selects.

#### Stage 2 — Email privacy

- A non-admin client must never receive another user's email. Surfaces that currently show or fetch email for non-admins (the access manager, the team roster) use display name as the identity instead.
- Email remains available to admins (the admin panel keeps showing it).
- Constraint: profile rows stay readable to teammates for display names, and RLS is row-level only, so email exposure is controlled at the column/query level — e.g. an admin-only path for email rather than a column every client selects.
- Profile emails are unique, case-insensitively, so a single email resolves to at most one account. Resolve any existing duplicates before adding the constraint.

#### Stage 3 — Relationship-scoped sharing picker

- The access manager's add-a-person picker offers only users the sharer has a relationship with: members of any team the sharer belongs to. It must not load or expose the global accounts table.
- The eligible set can reach 100+, so the picker is searchable and groups results by the team they come from rather than presenting one flat list.
- Sharing into one of the sharer's own teams stays a normal pick from their teams.

#### Stage 4 — Sharing with someone outside your teams

Two paths let an owner grant access to a user who is not a teammate, neither of which enumerates accounts or reveals an email:

- **Grant-by-link.** The owner mints a single-use, expiring, revocable link carrying the board/note and a capability, reusing the invites infrastructure. The first signed-in user to redeem it receives the grant bound to their own account.
- **Exact-email resolve.** The owner types a full email address. The server resolves at most one account and returns only its `{ id, display_name }`, never the email, and never a partial-match list. A miss is indistinguishable from a hit to the caller (no account-existence oracle).

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill for frontend tests. Cover at least: the picker offers only relationship-scoped users; no email is rendered to a non-admin while it still reaches the admin panel; exact-email resolve returns a single account without an email and treats a miss like a hit.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- A non-admin client receives no other user's email from any query or RPC.
- Profile emails are case-insensitively unique.
- The access-manager picker lists only relationship-scoped users, searchable and grouped, and never the full accounts table.
- An owner can grant access to a non-teammate by link and by exact email, with neither path enumerating accounts or returning an email.
- The style guide, `AGENTS.md`, and the code-review skill carry the rules above.

## Follow-ups

- **Friends / connections.** A consent-based connection beyond team membership, so users who share no team can become eligible to share with each other.
    - Decide how a connection forms (request/accept) and where it is managed.
    - Add connections as an eligible relationship in the sharing picker.
- **Email enforcement.** Require verified, real emails going forward.
    - Blocked on real SMTP (the built-in sender is rate-limited); coordinate with restoring the email invite path.
    - Decide handling of existing accounts with missing or unverified emails.

## Implementation Notes

### What shipped, by stage

- **Stage 1 — Guidance.** Added a "Pickers over growing sets" rule to `docs/style_guide.md` (UI Controls). Changed the style-guide reference in `AGENTS.md` from the `@`-import to a plain path so it loads on demand. Extended the Security item in `.claude/skills/code-review-custom/SKILL.md` to cover personal-data exposure (what RLS/RPCs return and what the client selects).
- **Stage 2 — Email privacy.** Migration `20260616172654_email_privacy.sql`: a case-insensitive unique index on `lower(email)`, the `email` column revoked from the authenticated select grant (a column list omitting it replaces the whole-table grant), and an admin-only `admin_list_profiles()` RPC (guarded by `is_admin()`) that returns email. Client: `access.ts`, `candidates.ts`, `useMembers.ts`, and `history/useRevisions.ts` select display name only; `useAdmin.ts` reads the profile list (with email) through the RPC; `MembersList` no longer shows an email line. No non-admin query selects email.
- **Stage 3 — Relationship-scoped picker.** `candidates.ts` loads the sharer's teammates across the teams they belong to (memberships + display names), never the accounts table. `PrincipalPicker.tsx` (Base UI Combobox, single-select) is searchable and groups a Teams group plus one group per team for its members. `AccessList` builds the groups and uses the picker; `AccessManager`/`NoteAccessManager` fetch candidates and take a new `memberTeams` prop (wired from `workspace.teams` in `App`).
- **Stage 4 — Sharing outside your teams.** Migration `20260616172655_outside_team_sharing.sql`: an `access_links` table (server-minted token, owner-only RLS, mirroring invites), `access_link_preview` and `redeem_access_link` RPCs, and `grant_board_by_email`/`grant_topic_by_email` RPCs. Client: `grants.ts`, the `OutsideTeamShare` block in the access manager (create link, share by email), and a `#/grant/<token>` redeem route (`useGrantRoute` + `GrantAccept`) wired into `App` behind the login gate.

### Decisions and deviations

- **Exact-email path returns nothing (resolves the plan's internal conflict).** Stage 4 asks both for the resolve to "return only `{ id, display_name }`" and for "a miss indistinguishable from a hit (no account-existence oracle)". Returning a display name for an exact email *is* an existence oracle, so the two cannot both hold. The no-oracle requirement (stated twice, and the test "treats a miss like a hit") wins: `grant_board_by_email`/`grant_topic_by_email` resolve and grant in one server step and return nothing, and the UI shows a fixed "if an account with that email exists, it now has access" message. The trade-off is that the owner does not see the resolved name; this is the secure reading and is reversible if a name confirmation is later wanted.
- **Grant-link redeem is an RPC, not an Edge Function.** The redeemer is already signed in (the grant binds to their account, no account creation), so `redeem_access_link` runs as a security-definer RPC — reusing the invites *patterns* (token table, trigger, validity-gated preview, atomic single-use claim) rather than the `redeem-invite` function. No Edge Function deploy is required for this change.
- **Picker scope = teams the sharer belongs to** (`workspace.teams`), distinct from the team principals they can grant to (the teams they coach). For an admin this is only their joined teams; admins reach non-teammates via the link/email paths, consistent with the plan.
- **Duplicate emails are guarded, not auto-resolved.** The email migration begins with a `DO` block that aborts with the offending addresses if any case-insensitive duplicates exist, since which account keeps an address is a human decision. The migration is transactional, so an abort changes nothing.

### Verification

- `npm run format`, `npm run lint`, `npm run typecheck`, and `npm run build` all pass.
- `npm run test`: 508 passing (46 files), including the updated sharing-manager tests, a new `GrantAccept` redeem test, and the existing `AdminPage` test (email still shown to admins via the RPC).
- Supabase: this worktree is linked; `db push --dry-run` confirms exactly the two new migrations would apply, with no history mismatch. **Not yet pushed** — production apply is the pending user-confirmed step (see Critical Issues).

### Critical Issues

- **The migrations are not yet applied to production.** The client now calls `access_links`, `redeem_access_link`, `access_link_preview`, `grant_*_by_email`, and `admin_list_profiles`, none of which exist on the remote until the push. Until then: the admin panel's profile list, the exact-email/grant-link paths, and the relationship picker's email-free reads behave as the *old* schema allows, and some will error. Apply with `npx supabase db push` (user-confirmed) and verify the schema afterward.
- **If production has duplicate emails, the push aborts.** The email migration self-guards and raises with the duplicate addresses. Resolve them by hand, then re-run the push. (I could not pre-check the remote: the read-only Supabase MCP is not connected this session.)
- **No browser/RLS end-to-end run was performed.** The RLS policies and RPCs are exercised only by reasoning and the in-memory Supabase fake (which does not model column grants or RLS). The server-side privacy guarantee — that a non-admin cannot select `email` — rests on the column-grant change and should be confirmed against the live database after the push (e.g. a non-admin `select email from profiles` should return `permission denied`).
