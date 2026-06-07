# Phase 2: Backend, Auth, and Sharing (Supabase)

## Implementation Agent Instructions

- **Role**: A full-stack engineer adding Supabase persistence, invite-only multi-team auth, and row-level security to a React + TypeScript SPA, treating server-side access control as the product's security boundary.
- **Task**: Replace the localStorage stores with Supabase-backed persistence; add invite-only accounts organised into teams (a global admin plus per-team coach/player roles); split content into per-team libraries and a private per-user personal space; enforce all access through row-level security; serve a share-token read-only viewer; and keep the free-tier project alive with a scheduled GitHub Action.
- **Quality bar**:
    - Read @CLAUDE.md and @docs/style_guide.md and follow them to the letter. Make minimal changes and keep the code clean and easy to maintain.
    - **RLS is the source of truth.** Never trust the client for access. Every read/write rule, including team isolation, must hold even if the UI is bypassed, and must be covered by a test against the database, not just the UI.
    - Honour the spine decisions in @plans/project_overview.md and @docs/architecture.md: normalized 0–1 coordinates, stable marker identity across steps, one court component, SVG, one `Board` type.
    - Keep the editor and playback behaviour from Phase 1 unchanged from the user's point of view; this phase changes where data lives and who may see it, not how a board is authored.
    - Where this plan leaves an implementation choice open (the data-fetching approach, role/membership storage, secrets handling, test mocking), default to modern, simple, secure-by-default practice and record what you chose in Implementation Notes.
    - **Do not self-provision or circumvent the backend.** Do not create the Supabase project, any account, or any external service yourself, and do not stub or work around a missing backend to make progress. The Supabase setup is the user's to do in Stage 0: it is your first action to hand them the exact steps, then wait for their confirmation and the values you need before doing anything that depends on the backend.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @plans/project_overview.md
    - @docs/architecture.md
    - @src/boards/useBoards.ts, @src/boards/storage.ts, @src/topics/useTopics.ts, @src/topics/storage.ts, @src/App.tsx
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in this file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`. If the section is `_None._`, write `Follow-ups: none.` Do not implement follow-ups unless explicitly asked.

## Plan

Phase 2 gives the Phase 1 app persistence and access control. The app already works in dev with everything in `localStorage`. This phase moves boards and topics into Supabase, adds invite-only accounts organised into teams, and splits content into two kinds of space: a coach-curated library per team that the team's members can view, and a private personal workspace for each user. Who can read and write each item is enforced in the database itself, and any visible board can be opened read-only through an unguessable share link. Nothing about authoring a single board changes for the user.

This phase introduces multi-team tenancy. That supersedes the "single private team" non-goal recorded in `project_overview.md`, which should be updated to match (tracked in Follow-ups).

### Concepts at a glance

| Concept        | What it is                                                                                       |
|----------------|--------------------------------------------------------------------------------------------------|
| Team           | A tenant with its own library. Only admins create teams.                                         |
| Membership     | A `(user, team, role)` link: the source of truth for who belongs to a team, and as what.         |
| Admin          | A global flag on an account. Creates teams, invites into any team, and has full access anywhere. |
| Coach          | A per-team role. Curates that team's library and invites people into that team.                  |
| Player         | A per-team role. Views that team's library, read-only.                                           |
| Team space     | A team's shared library: All Boards plus a topic tree, one per team.                             |
| Personal space | A user's private My Boards and My Topics, the same across every team.                            |
| Sharing        | Makes a personal board visible to a chosen team and mints a read-only link.                      |
| Promotion      | A coach copies or moves a shared board into their team's library.                                |
| Author lock    | A team board its author has locked so only they (and admins) can edit it; other coaches cannot.  |
| Share link     | An unguessable token that opens one board read-only, no account needed.                          |

| Action                                        | Player | Coach        | Admin          |
|-----------------------------------------------|--------|--------------|----------------|
| View their team's library                     | ✓      | ✓            | ✓ (every team) |
| Create or edit team content                   | —      | ✓ (own team) | ✓ (every team) |
| Edit a team board its author has locked       | —      | author only  | ✓              |
| Create and edit own personal boards           | ✓      | ✓            | ✓              |
| Share a personal board to a team              | ✓      | ✓            | ✓              |
| Invite a member                               | —      | ✓ (own team) | ✓ (any team)   |
| Create a team                                 | —      | —            | ✓              |
| Read another user's unshared personal content | —      | —            | ✓ (god-mode)   |

### Goals

- Boards and topics persist in Supabase and survive across devices and browsers, not just one browser's `localStorage`.
- Accounts are invite-only and organised into teams, with a global admin plus per-team coach and player roles.
- An admin creates teams and can invite anyone into any team; a coach can invite people into their own team(s); onboarding never requires touching code or the database by hand (beyond the first admin).
- Each team has its own library (All Boards plus a topic tree) that its members view and its coaches curate.
- Every user has a private personal workspace (My Boards and My Topics) they alone can see and edit.
- Sharing a personal item exposes a read-only link and makes the item visible to a chosen team and copyable by any account.
- Coaches can promote a shared item into their team's library by copying or moving it.
- All read and write rules, including team isolation, are enforced in the database with row-level security, so they hold even if the client is bypassed.
- The free-tier Supabase project never pauses, kept warm by a scheduled GitHub Action.

### Non-goals

- Deployment and a public website (Phase 3). Phase 2 runs against the local dev server and the managed Supabase backend.
- The final tag taxonomy, court geometry, and role/label conventions (still deferred from Phase 1).
- Collaborative co-editing of one board by multiple users, and the version-history layer it implies (see Follow-ups).

### Roles and teams

- **Team.** A tenant. Each team has its own library. Only an admin creates teams.
- **Global admin.** An app-level flag on a normal account, orthogonal to team membership. One account can be a player in one team, a coach in others, and a global admin at the same time. An admin creates teams, invites anyone into any team, manages all memberships, and has full read/write access across all teams. Admins can grant admin to other accounts. The first admin is created by hand (bootstrapped at the start of Stage 1); there is no separate admin login. This full reach over personal content is a privacy trade-off, acceptable while the app serves a small trusted group. It must be stated plainly in the README, noting it should be revisited before the app is ever made available more widely.
- **Per-team roles.** Membership is a `(user, team, role)` relationship where role is `coach` or `player`. A user may belong to several teams with a different role in each.
    - **Coach**: curates their team's library and can invite people into that team.
    - **Player**: views their team's library, read-only.
    - **Author lock**: a coach can lock a team board they authored so that only they (and admins) can edit or delete it; other coaches cannot edit it or change the lock. By default a team board is unlocked and any coach of the team can edit it.
- The data model supports multi-team membership, but the UI may assume the common single-team case and need not build dedicated multi-team management screens beyond what onboarding requires.

### The two spaces

Every board and topic lives in exactly one space.

- **Team space — per team, coach-controlled.** A team's shared library: an "All Boards" grid and that team's topic tree. Visible to the team's members. Only the team's coaches (and admins) can create, edit, organise, or delete its content.
- **Personal space — per user, across teams.** A user's own "My Boards" and "My Topics", private to that user and independent of any team. The owner has full read and write. It is invisible to everyone else, including coaches and admins of their teams, until the owner shares an item.

Navigation must let a user move between their personal space and each team they belong to. Creating content defaults to the space the user is in:

- A generic "New" defaults to the personal space.
- "New" from within a team library defaults to that team's space; from within the personal space, to the personal space.
- The chosen space is overridable at creation, except that creating in a team space requires the coach role in that team.

### Data model (server)

- **Teams.** A `teams` table (id, name, timestamps).
- **Memberships.** A `(user, team, role)` table, role being `coach` or `player`. The single source of truth for who is in a team and as what.
- **Profiles.** Per account, carrying the global admin flag (and any per-account fields RLS needs).
- **Boards.** The Phase 1 `Board` persists as a row with its `markers` and `steps` stored as JSON, plus:
    - `owner`: the creating account (the board's author).
    - `scope`: `team` or `personal`.
    - The team a board belongs to: for a team board, its team; for a shared personal board, the team it has been shared into; otherwise none.
    - `shared`: whether a personal board has been shared (link-resolvable and visible to its target team). Irrelevant for team boards, which are always visible to their team.
    - `authorLocked`: when set on a team board, only its author and admins may edit, delete, or clear the lock; other coaches cannot. Off by default; irrelevant for personal boards.
    - `share_token`: an unguessable token resolving to exactly this one board.
    - `topicId` / `topicOrder` carry over from Phase 1 and reference a topic in the same space (or none).
    - The `published` flag from the overview is dropped: the personal/team split already expresses draft-versus-visible.
- **Topics.** Persist server-side, preserving the Phase 1 tree shape (`parentId`, `order`, markdown `body`), and gain `owner` and `scope` like boards, plus their team for team-scoped topics. Each team has one topic tree; each user has their own personal topic tree.

### Data layer (client)

- Keep the `useBoards` / `useTopics` hook surface so the rest of the app changes as little as possible, but make them async: load the current user's visible boards and topics on mount with loading and error states, and write each mutation through to Supabase.
- Loads are scoped to the active context (the selected team's space, or the personal space).
- Concurrency is last-write-wins per item. Co-editing is a follow-up.
- The data-fetching approach (a library versus a thin hand-rolled Supabase client) is the implementer's call: pick the modern, simple option that fits this small app.

### Access control (RLS)

The security heart of the phase. Every rule below is enforced by policy, not merely by the UI.

- **Read.**
    - Team items: any member of that team.
    - Personal items: the owner always; plus members of the target team once the item is shared.
    - Token: a no-account visitor can resolve exactly one board that is team-scoped or shared, and cannot enumerate the collection.
- **Write (create, edit, delete).**
    - Team items: coaches of that team. A team board may be author-locked: while locked, only its author (and admins) may edit or delete it, and only its author (and admins) may set or clear the lock.
    - Personal items: the owner only.
    - No other writes exist in this phase (co-editing is deferred).
- **Admin.** Full read/write across all teams and all content, plus management of teams and memberships.
- **Team isolation.** A member of one team cannot read or write another team's content. This is the most important property to prove against the database.
- **Privacy.** An unshared personal item is invisible to everyone except its owner, coaches and admins included (admin god-mode aside).
- **Copy.** Any authenticated user can deep-copy a readable shared item into their own personal space.
- **Promote.** A coach can deep-copy or move a shared item into their team's library. A move relocates it; a copy leaves the original in the owner's personal space. Copies are always deep copies (no deduplication).

### Auth and invites

- **Invite-only**, no public signup. An invite always targets a team with a role. A coach invites a person by email into their own team; an admin invites into any team. Supabase emails an invite; the user sets a password and signs in with email + password.
- A coach assigns the invited account's role within their team; an admin manages roles and teams generally.
- The app gains a login surface and route guards. An unauthenticated visitor reaches only the login screen and any valid share link.

### Sharing

- **Share link.** Every board has an unguessable token. A share route opens that one board in a read-only viewer, reusing the Phase 1 `BoardView` (no library, no browse, no edit). The link resolves for team boards and for shared personal boards; an unshared personal board's link does not resolve.
- **Share target.** Sharing a personal board makes it visible to a chosen team the owner belongs to, defaulting to their team and prompting for a choice only when they belong to more than one.
- **Copy from a share.** An account holder viewing a shared board can deep-copy it into their personal space.
- **Server-side read-only.** Read-only for players and link visitors is enforced by RLS, not just hidden in the UI.

### Keep-alive

- A scheduled GitHub Action pings the Supabase database a few times a week so the free-tier project never pauses (recovery from a pause needs a manual dashboard restore).

### Stages

Build in order. Stage 0 is a setup gate the user performs; the two build stages follow. Each stage is shippable and reviewed before the next. This phase is mostly backend and security, so review centres on correctness and access enforcement; the new user-facing surfaces (login, team and personal libraries, sharing) still get a look on screen.

- **Stage 0 — Supabase setup (the user does this; the agent stops and walks them through it).**
    - A gate, not coding work, and the agent's first action. The agent presents a precise, ordered checklist, provides any values or snippets needed, and waits. It does not create the project or any account itself, and does not begin Stage 1 until the user confirms the project exists and the env vars are set.
    - The user, in their own Supabase account: create the project; copy the project URL, anon key, and service-role key; put the URL and anon key in the app env (for example `.env`), and keep the service-role key aside for the keep-alive Action secret only, never in client code.
    - The user: enable email auth (built-in email or SMTP) so invites send, and set the site/redirect URL to the dev server.
    - To keep the user's manual work minimal, the agent delivers everything that is not account-bound as code the user simply runs: the schema, RLS, and seed as migrations in Stage 1.
- **Stage 1 — Persisted, authenticated, team-scoped library.**
    - First, reconcile `plans/project_overview.md` with this plan: it still describes a single team, so update it to the multi-team model (a global admin plus per-team coach/player roles, the team and personal spaces, no published flag) before building. This is the one doc fixed up front, because it states intent the decision has changed rather than describing current code.
    - The schema (teams, memberships, profiles, boards, topics with team scoping) and RLS, written by the agent as SQL migrations. Applying them is the user's step by default (paste the SQL, or run `supabase db push`); the agent provides the migrations and waits rather than provisioning anything itself. If the user grants database access, the agent may apply them directly.
    - Bootstrap the first admin: after the schema is applied, walk the user through creating their account and marking it admin, and wait for confirmation. From then on teams, coaches, players, and invites are all self-serve in the app.
    - The async data layer replacing the localStorage stores, scoped to the active context, with a seed of a first team and sample content.
    - Invite-only auth (email + password); the global admin flag and per-team coach/player roles; team creation by admins and invites by coaches (own team) and admins (any team); the login surface, route guards, and team switching.
    - RLS for team spaces and personal ownership: team items readable by members and writable by their coaches; personal items readable and writable only by their owner; admin god-mode; strict team isolation.
    - The author lock on team boards: an "only I can edit" toggle (shown to a board's author and admins) that, when set, limits editing, deletion, and unlocking of that board to its author and admins.
    - Outcome: each team's library is persisted in Supabase behind a login and shared across its members' devices.
- **Stage 2 — Personal space, sharing, and share links.**
    - The personal space UI and navigation (My Boards, My Topics) and the creation defaults.
    - Sharing a personal item into a chosen team (read-only link, team visibility, copy-to-library) and coach promotion (copy or move), carrying a topic's full subtree.
    - The share-token read-only route and viewer.
    - The remaining RLS (shared and token read paths) and the keep-alive GitHub Action.
    - A final documentation pass (see Documentation).
    - Outcome: the full Phase 2 product.

### Documentation

As the last step, update the documentation that describes the code. These come last, not first: they document what shipped, so rewriting them before the code exists would describe a backend that is not there yet. (`plans/project_overview.md`, which states intent rather than current code, is reconciled first in Stage 1.) Keep each addition concise and in its document's existing voice and density: a backend and teams now exist, but the new material must not balloon past the proportions of what is already there. Prefer the tables in Concepts at a glance over long prose.

- `README.md`: note that the app now has accounts, teams, and a Supabase backend, and state plainly that admins can read all content, including users' personal boards. Frame it as acceptable for a small trusted group, to be revisited before the app is ever made available more widely, so the privacy expectation is clear.
- `AGENTS.md` (which `CLAUDE.md` includes): a short addition covering the backend, the two spaces, and the roles, in the file's terse rule style.
- `docs/architecture.md`: a concise section on the backend and access model, reusing the Concepts tables. Correct the existing sections this phase changes, above all that persistence is no longer `localStorage`. While here, check the data-model and organisation sections against the current code and fix any staleness (for example, a described "Unfiled" browse view the code may no longer have).

### Testing

Add or update unit tests to cover the changed behaviour — no more than the changes require. Mock the Supabase client (an external dependency) per the style guide; do not mock our own stores, components, or hooks. Cover access rules at the database/policy level, not only the UI, so read-only, team isolation, privacy, the author lock, and per-space enforcement are proven where they are enforced. Use the `react-testing` skill for frontend tests.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- Team-library boards and topics created in one browser appear in another for the same team after signing in.
- A member of one team cannot read or write another team's content, proven against the database.
- A player cannot write any team item, proven against the database, not just a disabled button.
- An admin can create a team and invite a coach into it; that coach can invite a player into their own team but not into a team they do not belong to.
- An author-locked team board can be edited, deleted, or unlocked only by its author and admins; another coach on the same team cannot, proven against the database.
- An unshared personal item is invisible to every other account, including a coach or admin of the owner's team (admin god-mode aside), proven against the database.
- Sharing a personal board makes it visible to the chosen team and link-resolvable; an account holder can copy it into their own space; a coach can copy or move it into their team's library.
- A share link opens exactly its one board read-only and exposes nothing else.
- The keep-alive Action runs on schedule and keeps the project from pausing.
- Documentation (README, AGENTS.md, architecture.md) reflects the phase, concisely and in each file's style.

## Follow-ups

- [ ] Add collaborative co-editing: let multiple invited users edit the same board together, with the version-history/revision layer that concurrent edits require. (Out of scope for Phase 2.)
- [ ] Split the management UI into two surfaces: team management, where a coach manages one team's members, invites, and roles; and admin management, where a global admin manages teams, accounts, and cross-team concerns.
- [ ] Add the ability to delete and archive accounts and teams.
    - An admin can delete or archive an account, and delete or archive a team. Archiving a team hides it from the main view but keeps it, restorable.
    - Deleting archives the affected data so it stays recoverable, instead of erasing it.
    - Team content belongs to the team, not to individuals: deleting an account keeps its team content, which is removed only when the team itself is deleted. (Requires changing the Stage 1 schema, where `boards.owner` / `topics.owner` currently cascade-delete.)
- [ ] Redesign the top-right header controls (team switcher, Manage, email, theme toggle, sign out): the current layout is rough. Use the frontend-design skill.

## Implementation Notes

### Status at a glance

- **Stage 0 (Supabase setup):** done by the user.
- **Stage 1 (persisted, authenticated, team-scoped library):** complete. Green on tests/build; RLS proven against the database (`supabase/tests/rls_policies_test.sql` passes); live checks verified by the user (login, persistence across reload and a second browser, invite round-trip, role select + re-roling, team creation + switcher, author lock, player read-only).
- **Stage 2 (personal space, sharing, share links, keep-alive):** not started.
- Work lives in the git worktree `.claude/worktrees/4-phase2` (branch `worktree-4-phase2`), committed through `64487ed`, except `supabase/tests/rls_policies_test.sql` left uncommitted per the user's instruction. Not merged to `4-backend`.

### Working agreement with the user

- The user performs all Supabase actions themselves (dashboard SQL, bootstrapping, Edge Function deploy). The agent must not log in to Supabase, install deploy tooling, or run deploys/migrations. Hand over exact steps and wait.
- Keep instructions plain and non-technical; do not paste code blobs into chat for the user to copy. Point to the file instead.

### Environment / facts

- Supabase project ref `xobsdirytehneeofjmrq` (eu-west-2). `.env.local` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (new key format `sb_publishable_...`).
- Admin account: `jan.corsten92@gmail.com`, `is_admin = true`. Seed team "My Team" id `11111111-1111-1111-1111-111111111111`.
- DB verified earlier: 5 tables, RLS enabled on all, 18 policies, 9 functions, 6 triggers, admin flag set, seed present (My Team + coach membership + 3 topics + 2 boards).
- Dev server runs from the worktree on `http://localhost:5173` (started for the user's manual testing).

### What was built (Stage 1)

- **Auth (Increment 1):** `@supabase/supabase-js`; `src/supabase/client.ts`; `src/auth/useAuth.tsx` (`AuthProvider` + `useAuth`: session/user/loading/signIn/signOut); `src/auth/Login.tsx`; gate in `src/App.tsx`; `src/main.tsx` wraps `AuthProvider`. Live-verified: bad credentials are rejected by the real project.
- **Async data layer (Increment 2):** `src/supabase/rows.ts` (Board/Topic ↔ DB row mappers); `src/workspace/useWorkspace.ts` (profile `is_admin`, memberships, `activeTeamId`, `activeRole`, `createTeam`); `src/boards/useBoards.ts` and `src/topics/useTopics.ts` rewritten async + scoped to the active team, optimistic writes with refetch-on-error; `App` gates on load/error.
- **Permissions (Increment 3):** `Board` gained `owner: string` and `authorLocked: boolean`. `canEditTeam = admin || coach`; `canEditBoard = admin || (coach && (!authorLocked || owner === me))`. `canEdit` threaded through `Browse` → `Library`/`TopicView`/`TopicSidebar`; `BoardView` got a "Lock editing" toggle (author/admin only) wired to `useBoards.setBoardLock`.
- **Team management (Increment 4):** `supabase/functions/invite/index.ts` (Edge Function); `src/supabase/invite.ts` (`inviteMember`, surfaces the function's error body); `src/ui/Dialog.tsx`; `src/team/TeamManager.tsx` (members list with per-member role editor + invite form + admin create-team); `src/team/useMembers.ts` (`setRole`); header team switcher (`Select`, shown when >1 team) + "Manage" button; `workspace.createTeam`. Plus migration `20260607000001_service_role_grants.sql` (grants `service_role` the table privileges the invite function needs) and a `Select` z-50 fix so dropdowns clear the modal layer.
- **DebugMenu cleanup (Increment 5):** `src/ui/DebugMenu.tsx` is now a single "Reset local state" action.
- **Tests:** `tests/helpers/supabaseFake.ts` (in-memory mock client; `setFakeAuthz`/`resetFakeAuthz`; seeds samples; `functions.invoke` stub). `tests/App.test.tsx` reworked: `renderApp` is async, wraps `AuthProvider`, awaits the load; added permission, team-management, and reset tests. Board fixtures across tests updated for `owner`/`authorLocked`. **158 tests pass; format/lint/typecheck/build pass.**
- **RLS tests:** `supabase/tests/rls_policies_test.sql` — self-contained SQL run in the Supabase SQL editor. It creates throwaway users/teams/boards, impersonates each user via JWT `sub` claims, asserts team isolation, player read-only, the author lock, and admin override at the policy level, then rolls back. Passes against the live database.

### Decisions (where the plan left choices open)

- Data fetching: hand-rolled async hooks keeping the `useBoards`/`useTopics` surface; no extra data-fetching library. Optimistic updates, refetch on write error.
- Auth: Supabase Auth (email + password), context provider, state-based navigation behind an auth gate (no router yet; the share route comes in Stage 2).
- Board model carries `owner` + `authorLocked` so the UI can gate edits; the lock is written via a dedicated `setBoardLock` (separate from content updates) to respect the `enforce_board_guards` trigger.
- Invites run in an Edge Function: it authorizes the caller via their own login (RLS-read profile/membership), then uses a privileged client for the account creation + membership upsert. Team creation and member re-roling are client-side writes (admin/coach RLS allows them).
- The function's privileged client uses a new-format secret key from `SUPABASE_SECRET_KEYS` (the legacy `SUPABASE_SERVICE_ROLE_KEY` is rejected on this project). `service_role` must be granted table privileges explicitly (see the grants migration); RLS bypass alone is not enough.
- The invite function's "Verify JWT with legacy secret" gateway toggle is **OFF** (new keys are not gateway-verified; the function authenticates the caller itself).

### Pending

- **Latent z-index bug:** `Menu`/`Combobox`/`Tooltip` positioners are still `z-30` and would render behind a `z-40` dialog. Only `Select` was fixed (the one in a dialog today). Lift the others when a dialog first needs them.
- **No unit test added for the dropdown fix or member re-roling.** The z-index bug is purely visual (not observable in happy-dom). A re-role test needs a second seeded member, which the deliberately filter-blind `supabaseFake` cannot provide without disturbing `useWorkspace`'s team derivation. Revisit if the fake gains filter awareness.
- **Stage 2:** not started. Scope is in the `### Stages` section above, not repeated here. (`plans/project_overview.md` is already reconciled to multi-team; the doc pass still owes `README.md`, `AGENTS.md`, `docs/architecture.md`.)
- **Cleanup:** `src/boards/storage.ts` and `src/topics/storage.ts` are now vestigial for the app (they only supply `SAMPLE_BOARDS`/`SAMPLE_TOPICS` to the tests and are themselves tested); consider extracting the samples and dropping the localStorage load/save/clear.

### Critical Issues

- _None open._ The invite blocker below is resolved.

### Resolved

- **Invite Edge Function `permission denied for table profiles`.** Root cause: `service_role` was never granted table privileges. The init migration has the Data API's "automatically expose new tables" off, so grants are explicit, and only `authenticated` was granted. `service_role` bypasses RLS but still needs the table GRANT, so the function's secret-key client was denied. Fixed by migration `supabase/migrations/20260607000001_service_role_grants.sql` (usage + full DML on all five tables to `service_role`), which the user ran. **Invites now work** (admin invited a player live). The deployed function reads the privileged key from `SUPABASE_SECRET_KEYS` (`privilegedKey()`); the temporary diagnostics and dead key fallbacks have been removed from the file — the user should redeploy it once at their convenience to pick up the slimmer version (behaviour is unchanged; only error text differs). Keep "Verify JWT" OFF.
- **Could not select a coach when inviting; the role dropdown did nothing.** All popup positioners were `z-30` but `Dialog` is `z-40`, so the `Select` opened behind the modal backdrop. Fixed by bumping the `Select` positioner to `z-50` (`src/ui/Select.tsx`). The same latent issue remains for `Menu`/`Combobox`/`Tooltip` inside a dialog — see Pending.
- **No way to change a member's role after inviting.** Added a per-member role `Select` in `TeamManager` wired to `useMembers.setRole` (a `memberships` update; allowed by the `memberships_update` RLS policy for coaches/admins). The caller's own row stays read-only to avoid self-lockout.
