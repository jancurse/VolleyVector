# Account, team, and membership deletion with grace-archive

## Implementation Agent Instructions

- **Role**: Full-stack engineer comfortable with Supabase RLS, Postgres functions/triggers, Deno Edge Functions, and a React 19 + TypeScript + Vite client.
- **Task**: Add admin-driven account and team deletion, reversible team archiving, coach-driven player removal, and a 3-month grace-archive for all deleted boards/topics, with an admin recovery surface.
- **Quality bar**:
    - Read @CLAUDE.md and @docs/style_guide.md and follow them to the letter.
    - Make minimal changes to implement the feature. Do not relitigate spine decisions in @docs/architecture.md.
    - RLS is the access boundary. Never trust the client. Every new rule holds in the database.
    - Hand the user exact Supabase steps (migrations, Edge Function deploy, purge scheduling); never self-provision or run Supabase actions. Grant `service_role` on anything new. Edge Functions read `SUPABASE_SECRET_KEYS`, keep "Verify JWT" off, and authorize the caller in code.
    - Use the `frontend-design` skill when building the admin panel surface, and the `diagnostics` and `react-testing` skills as the work requires.
- **Required reading**:
    - @CLAUDE.md, @docs/style_guide.md, @docs/architecture.md (Backend and access control, State/persistence/app shell sections)
    - Backend: `supabase/migrations/20260606000001_init.sql`, `supabase/migrations/20260606000002_rls.sql`, `supabase/migrations/20260607000002_sharing.sql`, `supabase/functions/invite/index.ts`
    - Client data layer: `src/supabase/rows.ts`, `src/supabase/invite.ts`, `src/boards/useBoards.ts`, `src/topics/useTopics.ts`, `src/boards/types.ts`
    - Client UI/state: `src/workspace/useWorkspace.ts`, `src/team/TeamManager.tsx`, `src/team/useMembers.ts`, `src/App.tsx`, `src/ui/useConfirm.tsx`, `src/ui/AlertDialog.tsx`
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` per its section description.
- **Surface follow-ups (MANDATORY)**: Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message as `- [ ] <item>`. If `_None._`, write `Follow-ups: none.` Do not implement follow-ups unless asked.

## Plan

### Context

Today every foreign key to `profiles(id)` is `ON DELETE CASCADE`, and `profiles` cascades from `auth.users`. Deleting a user therefore hard-deletes every board and topic they authored, including team content that should outlive them. There is no soft-delete, no team archive, and no UI to remove a player or delete an account or team.

This change introduces four distinct removal semantics, each with its own field and mechanism:

- **Remove a player** (coach or admin): drop the membership only; content untouched.
- **Archive a team** (admin): reversible, hidden from normal use but findable and restorable.
- **Delete a team** (admin): the team and its content are grace-archived, then purged after 3 months.
- **Delete an account** (admin for anyone, or a user for themselves): the user's personal content is grace-archived; team content they authored is reassigned to the team (owner becomes null, meaning "authored by the team").

A single grace-archive mechanism (`deleted_at` on boards and topics) backs every deletion: a deleted row is hidden from normal views, kept for 3 months for admin recovery, then permanently purged. Team archive is a separate, reversible state on the team and is not the same as the grace-archive.

### Decisions

- **Retention is a fixed 3 months**, not configurable.
- **All board/topic deletions are soft** (grace-archived), including a coach or owner deleting a single item in normal use. There is one recovery mechanism, admin-only.
- **Recovery is admin-only.** No user-facing trash. Team archive is the only reversible state an admin manages that keeps content live; grace-archived content is restored only by an admin within the window.
- **Admin actions live in a new standalone admin panel.** Player removal lives in the existing team panel (`TeamManager`). The team-manager split is separate in-flight work; build the admin panel simply so it can be rebased and integrated later.
- **Account deletion authorization**: an admin may delete any non-admin account; any non-admin user may delete their own. Self-deletion is one-way (no self-recovery).
- **Admin accounts cannot be deleted** by anyone, including themselves. Deleting an admin requires first revoking their admin flag.
- **An orphaned board's author lock is cleared** when its owner becomes null, so the team's coaches can edit it. A team may be left without a coach by deletion; this is allowed and unguarded.

### Backend

A single new migration (timestamped after the existing ones) carries all schema, trigger, RLS, and function changes. A separate Edge Function directory carries account deletion.

#### Schema changes

- `boards` and `topics`: add `deleted_at timestamptz` (nullable, default null) and `deleted_by uuid references profiles(id) on delete set null` (nullable).
- `boards.owner` and `topics.owner`: make **nullable**, and change the owner foreign key from `on delete cascade` to `on delete set null`. A null owner means "authored by the team". (Recreate the FK constraints to change the delete action.)
- `teams`: add `archived_at timestamptz` and `deleted_at timestamptz` (both nullable). Archived is the reversible state; deleted starts the 3-month purge clock.
- Add partial indexes on `boards(deleted_at)` and `topics(deleted_at)` where `deleted_at is not null` to keep the purge cheap, and confirm `service_role` retains its table grants for the new columns (column changes inherit table grants; no new grant needed unless a column-level grant is added).

#### Trigger fix (load-bearing)

- `enforce_board_guards()` currently raises whenever `new.owner is distinct from old.owner and not is_admin()`. This blocks the `on delete set null` cascade (which runs as an UPDATE under a non-admin session) and any orphaning. Change it to:
    - **Permit setting `owner` to NULL by anyone** (orphaning to the team), and require admin only to change `owner` to a different non-null value.
    - **Auto-clear the lock on orphan**: when `new.owner is null`, set `new.author_locked := false`. A lock is meaningless without an author who can reach the board, so an orphaned team board becomes editable by the team's coaches normally. Skip the author-lock guard when `owner` is null (the trigger is what clears it); otherwise keep the existing author-lock guard.

#### RLS

- New columns do not need new select policies. Keep deleted rows readable by the existing policies so admins (and owners/coaches) can recover them; normal hiding happens in the client queries. Verify the existing board/topic `update` policies still let an admin clear `deleted_at` (admin god-mode covers it) and let a coach/owner clear it on their own live content.
- After an account deletion orphans team content, the board's lock is cleared (see Trigger fix), so the team's coaches edit it normally; no admin-only state is left behind.
- `teams` archive/delete are admin-only writes already covered by the existing `teams_update` (`is_admin`) policy when done as updates. Team deletion is done via an RPC (below), not a raw `DELETE`, so the team cascade never hard-nukes content that must be grace-archived.

#### Functions (RPCs, `security definer`, `set search_path = ''`, granted to `authenticated`)

- `delete_team(team uuid)`: admin-check (raise if not `is_admin()`); set `deleted_at = now()` on the team row and on all its boards and topics (with `deleted_by = auth.uid()`). Do not hard-delete; the purge job removes it later.
- `soft_delete_topic(root uuid)`: replicate today's cascade semantics as a soft-delete. Collect the subtree under `root`, set `deleted_at`/`deleted_by` on every topic in it, and set `topic_id = null` on any board whose `topic_id` is in the subtree (so member boards return to Unfiled rather than vanish). Authorization is enforced by the same conditions as `topics_delete`; raise if the caller may not delete `root`.
- `purge_expired()`: hard-delete boards and topics where `deleted_at < now() - interval '3 months'`, and teams where `deleted_at < now() - interval '3 months'` (the team cascade then cleans its remaining rows). This must not be callable by `anon`; grant execute to `service_role` only (and/or schedule via `pg_cron`).
- Archive/unarchive a team and restore (clear `deleted_at`/`archived_at`) and restore grace-archived content (clear `deleted_at`) can be plain client UPDATEs under admin RLS; no RPC required. Add RPCs only if a client UPDATE proves awkward.

#### Edge Function: `delete-account`

- New directory `supabase/functions/delete-account/`, mirroring `supabase/functions/invite/index.ts` (CORS, `privilegedKey()` from `SUPABASE_SECRET_KEYS`, caller client for authorization, admin client for the privileged act).
- Body: `{ userId?: string }`. Resolve `target = userId ?? caller.id`. Authorize: allowed if `target === caller.id` (self-delete) or the caller's profile `is_admin`. Otherwise 403.
- **Admin accounts cannot be deleted by anyone, including themselves.** Look up the target's `is_admin`; if true, reject with an error before any destructive step. (To delete an admin, an admin first revokes their admin flag via the existing `set_admin` RPC, then deletes them.)
- Steps with the privileged client: set `deleted_at = now()`, `deleted_by = caller.id` on the target's **personal** boards and topics (`owner = target and scope = 'personal'`); then `auth.admin.deleteUser(target)`. Deleting the auth user cascades to the profile and, via the changed `on delete set null` FK, nulls `owner` on the target's remaining (team) content, reassigning it to the team. Memberships cascade away.

#### Purge scheduling

- Prefer `pg_cron` (a weekly `select public.purge_expired();`) if the project has it enabled. Otherwise extend `.github/workflows/keep-alive.yml` to invoke a tiny service-key-authenticated path that calls `purge_expired()`. The user runs/schedules this; hand over exact steps and let them choose.

### Client

#### Data layer

- `src/supabase/rows.ts`: widen `owner` to `string | null` on `BoardRow`, `BoardInsert`, `TopicRow`, `TopicInsert`, and on the `Board` model in `src/boards/types.ts`. Inserts still pass `user.id`. Add `deleted_at` (and `deleted_by`) to the row types so the admin recovery surface can read them; the `Board`/`Topic` client models used by the normal stores need not carry `deleted_at`.
- `src/boards/useBoards.ts` and `src/topics/useTopics.ts`: add `.is("deleted_at", null)` to `selectSpaceBoards` and `selectSpaceTopics` so archived rows drop out of every normal view.
- `deleteBoard`: change the write from `.delete()` to `.update({ deleted_at: <now>, deleted_by: <user.id> })`. Keep the optimistic removal from the in-memory list.
- `removeTopic`: change the write from `.delete()` to the `soft_delete_topic` RPC so the subtree is soft-deleted and member boards are unfiled. Keep the optimistic tree update.
- Confirm the three `b.owner === user.id` comparisons in `src/App.tsx` behave correctly with a null owner (a null owner is not the current user, so author-only gates fall through to admin, which is the intended "authored by the team" behavior). No logic change expected; widen types only.

#### Workspace and team panel

- `src/workspace/useWorkspace.ts`: when building the team list, select `archived_at, deleted_at` alongside `id, name` and exclude teams that are archived or deleted, so neither appears in the space switcher.
- `src/team/useMembers.ts`: add `removeMember(userId)` that deletes the membership (`supabase.from("memberships").delete().eq("team_id", teamId).eq("user_id", userId)`), with optimistic local removal; RLS already permits a coach or admin.
- `src/team/TeamManager.tsx`: add a per-member **Remove** action (not for the current user), behind a danger confirm via `useConfirm`.

#### Admin panel (new, standalone, frontend-design skill)

- New component under `src/admin/` (e.g. `AdminPanel.tsx`), opened from a header action shown only when `workspace.isAdmin` (mirror the existing `Manage` button pattern in `src/App.tsx`). Keep it deliberately simple; it will be rebased into the forthcoming team-panel/admin-panel split.
- Sections:
    - **Teams**: list all teams the admin can see (admins read all via RLS), each showing its state (active / archived / deleted) with actions: Archive, Unarchive, Delete, Restore. Archive/unarchive/restore are admin UPDATEs; Delete calls `delete_team`.
    - **Accounts**: list profiles (admin reads all) with a **Delete account** action that calls the `delete-account` Edge Function with `{ userId }`, behind a danger confirm. Do not offer the action for admin accounts (they cannot be deleted).
    - **Recently deleted**: grace-archived boards and topics (query `deleted_at is not null`) with a **Restore** action (admin UPDATE clearing `deleted_at`). Keep this minimal.

#### Self-service account deletion

- New client wrapper `src/supabase/deleteAccount.ts` mirroring `src/supabase/invite.ts` (`supabase.functions.invoke("delete-account", { body })`, parse the function's error body). Self-delete sends no `userId`.
- Add a **Delete my account** action in the header (danger confirm). On success, sign the user out.

### Sequencing

1. Player removal: `removeMember` in `useMembers` + Remove button in `TeamManager`. RLS is already in place.
2. Keystone migration: nullable owner + `on delete set null` FK, `deleted_at`/`deleted_by` on boards/topics, the `enforce_board_guards` fix, and the soft-delete query filters + `deleteBoard`/`removeTopic`/`soft_delete_topic` wiring.
3. Team archive: `teams.archived_at`, workspace filtering, admin-panel Teams section archive/unarchive.
4. Team delete: `delete_team` RPC + admin-panel action.
5. Account delete: `delete-account` Edge Function, client wrappers, admin-panel Accounts section, and the header self-delete action.
6. Purge: `purge_expired()` + scheduling handed to the user.

### Testing

Add or update unit tests to cover the changed behavior, no more than the changes require. Use the `react-testing` skill. Focus on:

- `useBoards`/`useTopics`: deletion issues a soft-delete write (update with `deleted_at` / `soft_delete_topic` RPC), and space queries filter `deleted_at is null`. Mock Supabase as the existing store tests do.
- `useMembers.removeMember`: issues the membership delete and updates local state.
- `useWorkspace`: archived and deleted teams are excluded from the team list.
- `TeamManager`: a non-current member shows a Remove action that triggers removal after confirm.
- Admin panel: team archive/delete/restore and account-delete actions invoke the right calls (mock the RPCs/Edge Function); render gated on `isAdmin`.

Backend RLS/RPC/trigger behavior is verified manually by the user against Supabase (see Verification); do not attempt to run Supabase locally.

### Verification (end-to-end, run by the user)

After the user applies the migration and deploys `delete-account`:

1. As a coach, remove a player from a team; confirm the membership disappears and the player loses access.
2. Delete a board and a nested topic; confirm they vanish from normal views, member boards of the deleted topic show as Unfiled, and the rows still exist with `deleted_at` set (admin Recently-deleted shows them; Restore brings them back).
3. As admin, archive a team; confirm it leaves the switcher and appears in the admin Teams list; unarchive restores it.
4. As admin, delete a team; confirm its content is hidden and grace-archived, and the team shows as deleted.
5. Delete an account (self and admin-driven): confirm the account is gone, its personal content is grace-archived, and team content it authored remains, now showing "Team" as author (null owner). Confirm `auth.admin.deleteUser` succeeds (the trigger fix lets the owner-nulling cascade through).
6. Run `select public.purge_expired();` after backdating a `deleted_at` past 3 months; confirm the row is gone.

Use the `playwright` MCP tools to check the admin panel and header actions render and behave on screen.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill).
- A coach can remove a player; the member loses team access.
- All board/topic deletions are soft: the row persists with `deleted_at`, is hidden from normal views, and an admin can restore it within 3 months.
- An admin can archive (reversibly), delete, and restore a team; archived and deleted teams do not appear in the space switcher.
- An admin can delete any non-admin account; a user can delete their own. Admin accounts cannot be deleted. After deletion the personal content is grace-archived and authored team content remains with a null (team) owner and its lock cleared.
- `purge_expired()` permanently removes content and teams whose `deleted_at` is older than 3 months and is not callable by anonymous clients.
- The new admin actions live in a standalone admin panel gated on `isAdmin`; player removal lives in the existing team panel.

## Follow-ups

_None._

## Implementation Notes

All six sequencing steps are implemented. Diagnostics (Prettier, ESLint, `tsc`), the full test suite (180 tests), and the production build all pass.

**Revision — account deletion is now a soft-delete with recovery (supersedes the original "hard delete + null owner" decision).** During verification the owner agreed the right model is the standard one: deleting an account is reversible for 3 months. Deleting an account now **bans the auth user + flags `profiles.deleted_at`** (the recovery unit is the user's login + personal area). The user's authored **team content is detached to the team immediately** (`owner → null`, lock cleared) and is never part of the recovery window — it's the team's and stays forever. An admin **restores** within the window (un-ban + clear flag); a scheduled **purge** hard-deletes afterwards (personal content removed; team content already detached). This also fixed the original flat-list recovery UI: because account/team removals no longer stamp individual boards, the admin "Recently deleted" list is organized by entity — deleted teams, deleted accounts, and individually-deleted boards/topics, each restorable. See the updated backend/steps below.

**Integration note (rebased onto the landed team/admin split + invite links).** This branch was rebased on top of `11-follow-ups`, which by then carried two features that overlapped this work: "Split team management from admin management" (`41eb6be`) and "Add single-use invite links" (`169edc7`). Consequences:

- **Member removal is no longer added here.** The split already added `useMembers.remove` and a per-member Remove (icon button, with confirm) to `TeamManager`. I took those wholesale and dropped my duplicate `removeMember`/Remove-button and their tests.
- **The admin surface is the split's `AdminManager`, not a separate `AdminPanel`.** My Teams / Accounts / Recently-deleted sections (plus `useAdmin.ts`) were folded into `src/admin/AdminManager.tsx` alongside its existing "New team" section. `AdminPanel.tsx` was removed.
- **Header.** The split owns the "Team" and "Admin" buttons; I added only the self-service **Delete account** button. The invite-links feature owns the `#/invite/<token>` route, untouched here.
- **Migration timestamp** bumped to `20260609000001_deletion.sql` so it sorts after the invites migration (`20260608000001_invites.sql`); the two schemas are independent.

### What was built

- **Migration** `supabase/migrations/20260609000001_deletion.sql`:
    - `boards.owner`/`topics.owner` made nullable, FK changed from `on delete cascade` to `on delete set null` (drop + recreate `boards_owner_fkey` / `topics_owner_fkey`).
    - `deleted_at`/`deleted_by` on `boards` and `topics`; `archived_at`/`deleted_at` on `teams`; partial `deleted_at` indexes.
    - `enforce_board_guards()` rewritten: setting `owner` to NULL is allowed for anyone (so the orphaning cascade and any orphaning pass), a non-null owner change still needs admin, and an orphan auto-clears `author_locked` (the lock guard is skipped when owner is null).
    - RPCs `delete_team`, `soft_delete_topic` (granted to `authenticated`, both authorize internally) and `purge_expired` (PUBLIC execute revoked; granted to `service_role` only).
- **Migration 2** `supabase/migrations/20260609000002_account_soft_delete.sql`: adds `profiles.deleted_at`/`deleted_by` (+ partial index), and **simplifies `delete_team` to flag only the team** (its boards/topics ride along via the team's state and are cascade-removed at purge), so account/team removals no longer stamp hundreds of individual rows into the recovery list.
- **Edge Functions** (all mirror `invite`: CORS, `privilegedKey()`, Verify JWT off):
    - `delete-account` (reworked): authorizes self or admin, refuses an admin account, then **soft-deletes** — detaches authored team content (`owner → null`), flags `profiles.deleted_at`, and bans the auth user (`ban_duration`). No hard delete, no personal-content archiving.
    - `restore-account` (new): admin-only; clears `profiles.deleted_at` and un-bans.
    - `purge-expired` (new): service-key-gated; hard-deletes accounts whose `deleted_at` is older than 3 months (delete personal content + `auth.admin.deleteUser`) and calls the SQL `purge_expired()` for boards/topics/teams. Replaces scheduling the raw SQL call.
- **Client data layer**: `owner` widened to `string | null` on the row types and the `Board` model; `deleted_at`/`deleted_by` added to `BoardRow`/`TopicRow`. `selectSpaceBoards`/`selectSpaceTopics` filter `.is("deleted_at", null)`. `deleteBoard` now writes `deleted_at`/`deleted_by`; `removeTopic` calls the `soft_delete_topic` RPC.
- **Workspace/team**: `useWorkspace` excludes archived/deleted teams from the team list. (Member removal is the split's `useMembers.remove` + `TeamManager`, used as-is.)
- **Admin panel**: `src/admin/useAdmin.ts` (data + actions) plus Teams / Accounts / Recently-deleted sections folded into the split's `src/admin/AdminManager.tsx` (gated on `workspace.isAdmin` by `App`). Built with the existing UI components/tokens (the established, deliberate design system).
- **Self-service deletion**: `src/supabase/deleteAccount.ts` + `restoreAccount.ts` wrappers; a header **Delete account** action that confirms, then signs out on success.
- **Tests**: `useBoards`, `useTopics`, `useWorkspace`, `AdminManager` (incl. team/account/board restore), plus a self-delete test in `App.test`. The shared `supabaseFake` records writes/RPCs/invokes, supports `.is`/`.not`, and seeds a second member, a grace-archived board/topic, a deleted account, and a deleted team.

### Supabase steps for the user (nothing here is self-provisioned)

Migration 1 (`20260609000001_deletion.sql`) and the first `delete-account` deploy were already applied during verification. The soft-delete revision adds:

1. **Apply migration 2** `20260609000002_account_soft_delete.sql` in the SQL editor.
2. **Redeploy** `delete-account` (now the soft-delete version) and **deploy** `restore-account` and `purge-expired` (Dashboard → Edge Functions → Via Editor; Verify JWT off on all).
3. **Schedule the purge** by invoking the `purge-expired` function weekly with the secret key in the `Authorization: Bearer <sb_secret_...>` header (e.g. a `pg_cron` http call or a GitHub Action). It hard-deletes both expired accounts and expired content/teams.

### Critical Issues

- **Verification status.** Migration 1 is applied and verified (FK names matched the defaults; the board/topic grace-archive, team archive/delete, the owner→null cascade, and the SQL purge + anon-safety all checked out against the live DB). The **soft-delete revision is built and unit-tested but not yet deployed/verified** — migration 2 + the three functions still need to be applied and the recovery flow re-checked (delete → restore → purge for an account).
- **Banning as the disable mechanism**: a banned user can't get a *new* session, but an existing JWT remains valid until it expires (~1h). Self-delete signs the user out client-side; an admin-deleted user could linger on an open tab briefly. Acceptable; revisit if stricter immediacy is needed (revoke sessions on ban).
- **A team may be left coachless** by player removal or account deletion. This is allowed and unguarded by design (per Decisions).
