# Invite quota and open team creation

## Implementation Agent Instructions

- **Role**: Full-stack engineer fluent in Supabase (Postgres RLS, triggers, SECURITY DEFINER functions, Edge Functions) and React 19 + TypeScript.
- **Task**: Separate account creation (the scarce, quota-gated resource) from team membership and team creation (cheap, ungated), via a per-account invite quota, typed invite links, and team creation open to every account.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - Use the `supabase` skill before any database, migration, or Edge Function work. This is a production project: never push a migration or deploy a function without the user's explicit confirmation.
    - RLS stays the access boundary. Quota must be enforced server-side (database and/or Edge Function), never only in the client.
    - Preserve the core invariant: **only an admin can expand total onboarding capacity.** A non-admin can only spend from a quota an admin granted; a non-admin can never grant quota to anyone.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @docs/architecture.md — "Backend and access control" and "Auth, invites, and keep-alive"
    - @supabase/migrations/20260606000001_init.sql, @supabase/migrations/20260606000002_rls.sql, @supabase/migrations/20260608000001_invites.sql
    - @supabase/migrations/20260616172654_email_privacy.sql — `profiles` is now column-grant restricted (`authenticated` may select only `id, display_name, is_admin, created_at, deleted_at`), and `admin_list_profiles()` is the admin read path. `invite_quota` therefore needs RPC read paths, not a Data API select.
    - @supabase/functions/redeem-invite/index.ts
    - @src/invites/invites.ts, @src/invites/InviteAccept.tsx
    - @src/team/InviteDialog.tsx, @src/team/TeamPage.tsx
    - @src/workspace/useWorkspace.ts, @src/admin/AdminPage.tsx, @src/admin/useAdmin.ts
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. If you uncover unplanned work that belongs in its own future project, add it there. Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message as `- [ ] <item>`. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Goals

- Account creation is the only quota-gated action. Team creation, team membership, and adding existing accounts to a team are unlimited.
- A per-account invite quota (default 0) governs how many new accounts that account may bring into existence. Admin is unlimited and is the only role that can raise anyone's quota.
- Invite links are typed at mint: "new person" (consumes quota on redemption) or "existing user" (free).
- An invite may carry no team (onboards an account into its personal space only) as well as a team + role.

### Non-goals

- The email-invite path (`invite` Edge Function) stays hidden and unchanged.
- No change to sharing, boards, notes, or the showcase.
- No per-account cap on teams or boards.

### Invite link rights

An invite link carries up to three independent grants, in any combination:

- **Create an account** (`allows_new_account`): the link may onboard a brand-new account. This is the only quota-consuming grant, and it spends the **inviter's** quota when a new account is actually created.
- **Invite quota** (`grant_quota`): a number added to the redeemer's own quota, additive to whatever they already have. Only an admin may mint a link that grants quota, since it creates capacity from nothing.
- **Team membership** (`team_id` + `role`): joins the redeemer to a team.

The redeemer claims whatever applies to them, and an existing account always wins over the account-creation grant:

- **An existing account holder** may redeem any link by signing in. They ignore the account-creation grant (no account is created, so the inviter's quota is untouched) and additively claim the quota grant and the membership. This is the path for "send someone a link for +10 invites": a quota-only link with no team.
- **A brand-new visitor** may create an account only if the link allows it, which spends the inviter's quota; they then claim the quota grant and membership too. A link with no account-creation grant offers them sign-in only.
- Single use protects every grant: the atomic claim means a link's quota and membership can each be claimed exactly once.

### Quota accounting (the rule)

The consuming quota is the **inviter's** (`invites.created_by`). A live account-creation link reserves a slot; a redemption that creates an account spends it; everything else releases it. All of it is derived from the `invites` table, so release is automatic — there is no stored counter to decrement or refund.

- `available(user) = invite_quota(user) − used(user)`
- `used(user)` = count of invites where `created_by = user`, `allows_new_account = true`, and either:
    - **reserved**: `used_at is null and expires_at > now()` (live, unredeemed), or
    - **spent**: `created_account = true` (redeemed and actually created an account).
- An account-creation link redeemed by someone who already has an account sets `used_at` but leaves `created_account = false`, so it counts as neither reserved nor spent: the slot is released.
- An admin inviter is unlimited: no `available` check applies.

Enforced at two points:

- **Mint** of an account-creation link: reject if `available(created_by) < 1` (admins exempt).
- **Redeem** that creates an account: re-check `available(created_by) ≥ 1` atomically before creating the user (admins exempt), since quota or other redemptions may have changed since mint. On failure, release the claim and return a clear error.

### Data model changes

- **`profiles.invite_quota`** `int not null default 0`. Not in the `authenticated` column grant, so it is neither selectable nor settable through the Data API. Written only by an admin-only `set_invite_quota(target uuid, value int)` SECURITY DEFINER RPC, mirroring `set_admin`. Read only through the two RPCs below, since `email_privacy` narrowed the profile select grant to `id, display_name, is_admin, created_at, deleted_at`.
- **Quota read paths** (the column cannot be selected directly):
    - **`invite_availability()`** SECURITY DEFINER RPC, granted to `authenticated`: returns the caller's own `available` (`invite_quota − used`, the derivation under "Quota accounting"), for the invite dialog's remaining-quota display and the account-creation toggle. Admins read as unlimited.
    - **`admin_list_profiles()`**: extend the existing admin RPC's return with `invite_quota`, so the Accounts tab shows each account's quota without a column select. Update its return signature and the `AdminProfile`/`ProfileRow` types and mapping in `useAdmin.ts`.
- **`invites`**:
    - `team_id` becomes nullable (a team-less invite carries no membership).
    - `role` becomes nullable, required only when `team_id` is set (CHECK).
    - `allows_new_account boolean not null default true`: may this link create an account (the quota-consuming grant).
    - `created_account boolean not null default false`, set by the redeem function when it actually creates a user.
    - `grant_quota int not null default 0`: quota added to the redeemer's account at redemption (additive); settable only by an admin inviter.
- **`create_team(name text, slug text)`** SECURITY DEFINER RPC: inserts the team and the creator's `coach` membership together (slug-collision retry handled server-side) and returns the new id. This is the one creation path for every account, admins included.

### Access rules (RLS and triggers)

- **Quota at mint**: a BEFORE INSERT trigger on `invites` (alongside `set_invite_token`) raises when a non-admin inserts an account-creation link (`allows_new_account = true`) with no available slot, and raises when a non-admin sets `grant_quota > 0`.
- **Team creation**: every account creates teams through the `create_team` RPC (above), which makes the creator a coach. The raw `teams_insert` policy is not the creation path and stays as is; adding existing accounts to a team stays a coach/admin action as today.
- **`invites_insert`/`select`/`delete`**: keep `created_by = auth.uid()`; allow a team-less invite (no `is_team_coach` requirement when `team_id is null`); a team invite still requires coach/admin of that team. Creator and admin can list/revoke their own links.

### Redeem and preview

- **`redeem-invite` Edge Function**: resolve the redeemer, then apply every grant that applies to them additively.
    - Resolve user: the signed-in caller (existing account) or a brand-new account from the supplied email/password.
    - Create an account only when the link allows it and there is no signed-in caller; enforce the inviter's quota atomically at that point (admins exempt) and set `created_account = true`. An existing caller never creates an account and never touches the inviter's quota.
    - Reject a brand-new visitor (no session) on a link that does not allow account creation.
    - Apply `grant_quota` to the resolved user's profile additively (`invite_quota = invite_quota + grant_quota`).
    - Add the membership when `team_id` is set; with no team, grant only the account and any quota.
    - Release the claim on any failure, as today.
- **`invite_preview`** (`security definer`, anon): return `allows_new_account`, `grant_quota`, and a nullable `team_name`/`role`, so the accept screen can describe every right the link carries (join a team, get N invites, set up an account) and a team-less link. Validity rules (unused, unexpired) unchanged.

### Client changes

- **Unified `InviteDialog`**: choose the grants — allow account creation (new person) or not (existing user only), an optional team + role, and (admin only) a quota grant. Show the inviter's remaining quota (read via `invite_availability()`, since the column is not selectable) and disable the account-creation option at zero. Reached two ways: a pinned **Invite** entry in the sidebar foot (paired with the Admin entry, gated to an admin, an account with `invite_quota > 0`, or a coach/admin of at least one team), opened with no team pre-selected; or a team's "Invite member" button, pre-scoped to that team (team locked, role selectable).
- **`InviteAccept`**: describe every right the link carries; offer account setup only when the link allows it (otherwise sign-in / one-click claim only); render team-less copy ("Join VolleyCoach", or "Add N invites to your account") when there is no team. A signed-in visitor claims all applicable grants with one action.
- **`invites.ts`**: thread `allowsNewAccount`, optional team/role, and `grantQuota` through `createInvite` and the preview/redeem helpers.
- **`useWorkspace.createTeam`**: routes through the `create_team` RPC and is available to every account. The creator (admins included) becomes a coach and the team lands in their `teams` list; the previous admin-only "create without joining" behaviour is dropped. Expose a "New team" action at the foot of the team list in `SpaceSwitcher` (a small name dialog, then create and switch), available to everyone. The Admin panel's "Create team" stays and routes through the same RPC.
- **Admin (`AdminPage`/`useAdmin`)**: the Accounts tab is now a `ui/Table` (Account / Actions columns) fed by `admin_list_profiles()`. Add a quota column with an inline view-and-set control wired to a new `useAdmin.setInviteQuota` action calling `set_invite_quota`, and carry `inviteQuota` on `AdminProfile`/`ProfileRow` from the extended RPC. The admin's invite dialog may set a `grant_quota` on the link.

### Migration and seed

- One new migration adds the columns, the `set_invite_quota`, `invite_availability`, and `create_team` RPCs, the extended `admin_list_profiles` return, the quota/grant trigger logic, the widened `teams_insert`, the creator-membership path, and the `invite_preview` signature change. Backfill `invite_quota = 0` for all profiles (the column default covers new rows).
- Seed: set `invite_quota = 100` for Nancy and Nadim. Their exact profiles are confirmed with the user at apply time (by display name / email) before the update runs.

### Testing

Add or update unit tests to cover the changed behaviour — no more than the changes require. Use the `react-testing` skill for frontend tests. The test harness was reworked recently: write against the current `tests/helpers/supabaseFake.ts` and `supabase/tests/rls_policies_test.sql` shapes, not older patterns.

- Quota accounting: reserved/spent/released cases produce the right `available`.
- Mint rejects a non-admin over quota and a non-admin setting `grant_quota`; admin is unlimited.
- `InviteAccept` renders correctly for each combination of grants and for a team-less invite.
- A non-admin can create a team and lands on it as coach.
- Verify the SQL-level rules with the project's RLS test approach (`supabase/tests/`).

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- A non-admin with quota mints a "new person" link; redeeming it creates an account and decrements available; letting it expire or having an existing user redeem it releases the slot.
- A non-admin with zero quota cannot mint a "new person" link but can mint an "existing user" link and can create teams and add existing accounts to them without limit.
- An admin can set any account's quota and is themselves unlimited.
- An admin mints a quota-only link (no team); an existing user redeems it by signing in, their quota increases by the granted amount, no account is created, and no inviter quota is spent.
- Nancy and Nadim have a quota of 100.
- The core invariant holds: no non-admin action raises any account's quota.

## Follow-ups

_None._

## Implementation Notes

### What was implemented

- **Migration `20260618120000_invite_quota.sql`** (written, not applied):
    - `profiles.invite_quota int not null default 0`, outside the `authenticated` column grant.
    - RPCs: `set_invite_quota` (admin-only write, mirrors `set_admin`), `invite_available(target)` (the derived `quota − used`, restricted to `service_role`), `invite_availability()` (the caller's own, `null` for an admin, granted to `authenticated`), `add_invite_quota(target, amount)` (atomic additive increment, `service_role` only), and `create_team(name, slug)` (inserts the team + the creator's `coach` membership, slug-collision retry, granted to `authenticated`).
    - `admin_list_profiles()` dropped and recreated with `invite_quota` in its return.
    - `invites`: `team_id`/`role` made nullable with a `(team_id is null) = (role is null)` CHECK; new `allows_new_account`, `created_account`, `grant_quota` columns; a BEFORE INSERT `invites_quota` trigger that rejects a non-admin minting an account link over quota or setting `grant_quota > 0`.
    - `invite_preview` dropped and recreated to return `allows_new_account, grant_quota, team_name, role` (LEFT JOIN for team-less links).
    - `invites_insert`/`select`/`delete` policies widened: a team-less link needs no team coaching; the creator (and an admin) lists/revokes their own.
    - Seed: `update profiles set invite_quota = 100 where display_name in ('Nancy','Nadim')`.
- **Edge Function `redeem-invite`**: claims the link, resolves the user (signed-in caller wins over account creation), creates an account only when the link allows it and there is no caller (re-checking the inviter's quota atomically, admins exempt), adds the membership only when `team_id` is set, applies `grant_quota` additively via `add_invite_quota`, and records `created_account`/`used_by` only on full success so a released claim never counts as spent.
- **Client**: `invites.ts` (`createInvite`/`invitePreview`/`inviteAvailability` threaded through the new shape); unified `InviteDialog` (link-type toggle, optional team picker, admin bonus-invites field, live remaining-quota); reworked `InviteAccept` (describes every grant, account setup only when allowed, team-less copy, one-click claim); `useWorkspace.createTeam` routes through `create_team` (creator becomes a coach, lands in `teams`) and exposes `inviteAvailable`; `SpaceSwitcher` "New team" dialog; sidebar/rail **Invite** entry gated on admin / quota / coach-of-any-team; admin Accounts tab gains an inline quota control (`useAdmin.setInviteQuota`).
- **Tests**: `supabaseFake` + RLS SQL test extended; new coverage for quota accounting/mint rejection (SQL), `InviteAccept` grant combinations, non-admin team creation, and admin quota set. `npm run test` (555), `lint`, `typecheck`, and `build` all pass.

### Decisions and deviations

- **`teams_insert` left admin-only.** The plan's detailed "Access rules" section says the raw `teams_insert` policy "is not the creation path and stays as is" (the migration-summary line calling it "widened" conflicts with this). `create_team` is `SECURITY DEFINER` and bypasses RLS, so neither `teams_insert` nor `memberships_insert` needs widening; both stay as-is. The invariant (only an admin expands onboarding capacity) is unaffected, since team creation is explicitly cheap/ungated.
- **Added `add_invite_quota` RPC** (not named in the plan) so the redeem function applies `grant_quota` as an atomic increment (`service_role`-only), avoiding a read-modify-write lost update on concurrent quota links. No authenticated path can raise a quota except the admin-only `set_invite_quota`.
- **Sidebar Invite gating uses `invite_availability()`**, not a raw `invite_quota > 0` read (the column is unselectable). Effectively the same, and more correct: it hides the entry when a non-coach has spent all quota and could mint nothing useful.
- **`create_team` returns only the id**; `createTeamAndOpen` navigates by id and lets the existing canonicalisation effect rewrite `/t/<id>` → `/t/<slug>`, matching how a new note is opened (avoids a stale-list slug lookup and a setState-in-effect lint violation).
- **Seed matches by display name.** Reading the production accounts' PII to confirm Nancy/Nadim was correctly blocked, and the plan says their profiles are confirmed with the user at apply time. The `display_name in ('Nancy','Nadim')` match no-ops safely if names differ; confirm before applying (or switch to an email match).
- **`docs/architecture.md` not updated.** A couple of lines ("Auth, invites" link description, the admin-only "Create a team" table row, "Creating a team adds no membership") are now stale. Left untouched to keep changes minimal and because the feature is not live until the migration applies; flagged for the user.

### Remaining to apply (part of this implementation — not yet done)

Status: code complete and verified against the test harness, but the feature is **not live**. The Supabase CLI was unavailable this session, so the steps below are outstanding. This implementation is not finished until they are done. They are user-only (production project; the `supabase` skill forbids pushing migrations or deploying functions without explicit confirmation, and DDL goes through the CLI, never the dashboard).

- [ ] **Confirm the seed identities.** The seed matches `display_name in ('Nancy', 'Nadim')`. Reading the production accounts' emails to confirm was correctly blocked, so verify those are their exact display names (or switch the seed to an email match) before applying — it no-ops silently if they differ.
- [ ] **Apply the migration:** `npx supabase migration list` → `npx supabase db push --dry-run` (confirm only `20260618120000_invite_quota` would apply) → `npx supabase db push`. Then verify `profiles.invite_quota` and the new RPCs exist (MCP query or PostgREST probe), not just the history table.
- [ ] **Deploy the Edge Function:** `npx supabase functions deploy redeem-invite` (keep "Verify JWT" off).
- [ ] **Verify the SQL rules:** run `supabase/tests/rls_policies_test.sql` in the SQL editor; expect `ALL RLS TESTS PASSED`.

### Critical Issues

None blocking. The code is complete; the only outstanding work is the user-only Supabase apply steps above.
