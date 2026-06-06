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

- [ ] Collaborative co-editing of a single board by multiple invited users, including the version-history/revision layer that concurrent edits require (tracked separately; out of scope for Phase 2).

## Implementation Notes

### Critical Issues
