# Collaboration and versioning for boards and notes

Plan for issues #1 (collaborative editing, cross-team and cross-space sharing) and #2 (edit history,
conflict handling).

## The locked access model

A board or note has a **creator** (a label for attribution, nullable) and an **access list**. Each entry
is `(principal, capability)`.

- **Principal**: a *user* or a *team*. A team is a first-class principal, so it can hold content directly.
- **Capability**: `viewer`, `editor`, or `owner`. Owner = edit + manage the access list + remove.
- **A team entry maps the team's roles, capped by the entry's capability.** Team viewer: every member
  reads, nobody writes. Team editor: coaches edit, players read. Team owner: coaches manage, players read.
  Players never write through a team entry; a specific player who needs write gets a direct user entry.
- **A board appears in a space's library when that space's principal is on its list**, so one board can
  live in several teams and a personal space at once.
- **Lifecycle is reference counting.** Content lives while its list is non-empty. "Delete" removes the
  caller's own entry; the row only grace-archives when the last entry goes. Admin retains a force-archive.

This retires `owner` (as a control field), `scope`, `shared`, `team_id`, and `author_locked`: each
collapses into the access list (author-lock = a team `viewer` entry beside the creator's `owner` entry;
move = add a team `owner` entry; share = add a team `viewer` entry; scope = derived from the entries).

### Decided defaults

- Three capabilities, owner non-unique (this is what dissolves the succession question).
- Sharing into a second team defaults that team to `viewer`; the sharer may grant `editor`/`owner`.
- The access list is editable by any owner of the content (plus admins). An `editor` changes content but
  cannot re-share.
- "Delete" = detach self; real archive only when the list empties; admin force-archive retained.

### Versioning (issue #2)

Linear history, no branching or merging. Co-editing means taking turns, made safe by conflict detection.

- Each commit (the editor's **Done**) writes an append-only **revision**: a full content snapshot with its
  author, timestamp, and the revision it was based on.
- **Conflict detection** is a compare-and-swap: a commit carries the revision it started from and is
  rejected if the content moved on. The editor then offers overwrite, save-as-copy, or discard.
- **History** is a panel on the board/note view: the revision list with a one-line change summary, a
  read-only preview at any revision, and **Restore** (which commits the old content as a new revision).
- **Diff** is a structured client-side summary (title/tags/markers/steps/blocks changed), not a visual
  overlay. Keep all revisions; a per-row cap is a trivial later tweak.

## Database changes (Supabase, production — apply only on the user's confirmation)

New migrations, in order. The server table stays named `topics`; its access table is `topic_access`.

1. **Access tables.** `board_access` and `topic_access`, each
   `(id, content_id → cascade, user_id → profiles cascade, team_id → teams cascade, capability, created_at)`
   with `check ((user_id is null) <> (team_id is null))` and partial unique indexes per principal. The
   cascades make account/team purge drop entries automatically, which feeds reference counting.
2. **Capability helpers** (`security definer`, non-recursive): `board_capability(board) → capability|null`
   and `topic_capability`. They return the caller's effective level: admin → owner; the max of direct
   user entries; for team entries, coach → the entry's capability, any member → at least viewer; showcase
   team → viewer for everyone. A small ordinal encodes the `viewer < editor < owner` order.
3. **RLS rewrite** for `boards`, `topics`, and the two access tables, all expressed through the helpers:
   - select when capability is not null; update when it is `editor`/`owner`.
   - access-table rows: read when you can read the content; write when you `manage` (own) it, plus you may
     always delete your *own* entry (leave); bootstrap the first owner entry from `created_by`.
   - board hard-delete stays admin-only; normal removal is the archive trigger below.
4. **Lifecycle trigger.** `after delete on board_access`/`topic_access`: if no entries remain for the
   content, stamp `deleted_at` (grace-archive). Replaces the owner-nulling logic.
5. **Versioning tables and commit RPCs.** `board_revisions`/`topic_revisions`
   `(id, content_id, content jsonb, created_by, created_at, base_revision_id)`, plus `current_revision_id`
   on `boards`/`topics`. `commit_board(id, content, base_revision_id)` updates the content and appends a
   revision only when `current_revision_id = base_revision_id`, else returns a conflict; same for topics.
6. **Backfill + column retirement.** From existing rows: personal → `(user=owner, owner)`; team →
   `(team, owner)`; author-locked team → `(team, viewer)` + `(user=owner, owner)`; shared personal also →
   `(team, viewer)`. Rename `owner` → `created_by`; drop `scope`, `shared`, `author_locked`, and the board
   guard trigger; keep `team_id` only if needed as a home anchor for slug uniqueness (see open questions).
   Seed each content's first revision from its current snapshot.
7. **`board_by_token`** updated to "has any team entry, or any user-shared entry," preserving the
   unshared-never-leaks rule. Showcase widening re-expressed as a viewer grant in the helper.

## Edge functions and RPCs

- **delete-account**: stop nulling owners and reassigning team boards. Soft-delete removes the user as an
  active principal; reference counting + grace-archive handle their now-orphaned personal content, while
  team-held content survives on its team entry. **restore-account** reverses it. **purge-expired**: the
  hard user/team delete cascades access rows, and the archive trigger sweeps anything orphaned.
- **delete_team / soft_delete_topic**: team removal drops the team principal (content shared elsewhere
  survives); note removal detaches the caller and archives the subtree only where it empties. Sharing a
  note applies to its whole subtree (entries written per node so reads stay non-recursive).

## Client changes

- **`supabase/rows.ts`**: drop `owner`/`scope`/`shared`/`author_locked`/`team_id` from the row mappers;
  add `created_by` (label) and a client-only derived `capability` per board/note. Add access-row and
  revision mappers.
- **`boards/types.ts`, `notes/types.ts`**: replace the four access fields with `createdBy` + derived
  `capability`. The access list itself is loaded on demand for the manage UI, not carried on every card.
- **`boards/useBoards.ts`, `notes/useNotes.ts`**: load a space's content by access entry for that space's
  principal (PostgREST inner-join on the access table). Replace `shareBoard`/`unshareBoard`/
  `moveBoardToTeam`/`setBoardLock` with access-list mutations (`grantAccess`, `revokeAccess`,
  `setCapability`). `updateBoard` commits through `commit_board` and surfaces conflicts. `deleteBoard`
  removes the caller's entry.
- **`workspace/`**: the active space still selects which library loads; per-board capability now comes
  from the store, not from `activeRole` + `authorLocked`.
- **`App.tsx`**: `canEditBoard`/`canEdit` read the board's `capability` instead of role + lock.
- **`src/sharing/`**: replace `ShareDialog`, `MoveToMenu`, `PromoteToTeamMenu` with one **access manager**
  panel (add a user or team, pick a capability, remove an entry, leave). `CopyToMenu`/`CopyToPersonal`
  stay as deliberate "fork a separate copy" actions. The share-token link and `ShareView` are unchanged.
- **New `src/history/`** (or under editor): a history panel listing revisions with summaries, a read-only
  preview through the existing `Court`/note render, restore, and the structured `diffBoards`/`diffNote`.
- **`src/admin/`**: recovery lists read archived content by `deleted_at` (no longer by non-null owner).
- **Bundle and board-creator skill**: unchanged. The bundle already excludes server-owned fields, so
  access and revisions never enter it and `FORMAT_VERSION` does not bump. Verify with the existing
  round-trip test.

## Documentation

Update in lockstep, **replacing** the retired prose rather than appending, so length stays flat.

- **AGENTS.md**: rewrite the "Spaces and roles" lines (content no longer lives in exactly one space) and
  the `src/sharing/` module-map entry; add the access manager and history modules in one phrase each.
- **architecture.md**: in "The data model", swap the four `Board` access fields for `createdBy` + derived
  capability. In "Backend and access control", rewrite "Tables and the two spaces", the who-may-do-what
  table, "Sharing and the share link", and "Deletion and recovery" around the access list and reference
  counting. Add a short "Versioning and history" subsection. Cut the author-lock, move, and shared-flag
  descriptions, since those concepts are gone.
- **README.md**: update the status line and the Sharing/Accounts feature bullets to describe co-editing,
  cross-team sharing, and history; keep god-mode note.
- **Proportionality pass (explicit final step)**: re-read all three docs and trim so collaboration and
  versioning occupy space proportional to other features, not a disproportionate block. Net size should
  be roughly unchanged because this content replaces the retired sharing/lock/scope prose.

## Tests

- Store tests (`useBoards`/`useNotes`): access-driven loads, grant/revoke/setCapability, detach-self
  delete, and conflict on stale-base commit.
- New access-manager UI test and history/diff tests (revision list, preview, restore, summary).
- `App` capability-gating test (viewer/editor/owner show the right actions).
- RLS policy tests under `supabase/tests/`: each capability path, the team role cap, the leave-vs-manage
  split, showcase, and the archive-on-empty trigger.
- Admin recovery test updated to the `deleted_at` list. Bundle round-trip test confirms no new fields.

## Build order (each commit independently shippable)

1. Access tables + helpers + RLS + lifecycle trigger + backfill; stores and `App` read capability; access
   manager UI replaces share/move/lock. (Issue #1 core: co-editing, cross-team, cross-space.)
2. Revisions + commit RPC + conflict dialog. (Safety for taking turns.)
3. History panel, preview, restore, structured diff. (Issue #2 visible surface.)
4. Edge-function and admin recovery updates; documentation; proportionality pass.

## Resolved sub-decisions (the "your defaults" answers)

- **Slug uniqueness**: topics keep a `team_id` home anchor; slugs are unique per home space, indexed on
  `coalesce(team_id, created_by)`. Boards have no slug, so boards dropped `team_id` entirely (placement is
  purely the access list, and a board link self-heals to any reachable space at lookup time).
- **Note subtree sharing**: sharing a note shares its whole subtree, surfaced at the target team's top
  level. Built: a grant is written per node so reads stay non-recursive (see follow-up 1 below).

## Progress

Naming note: server-side, Notes live in the table named `topics` (legacy), so every `topic_*` /
`commit_topic` / `topic_access` artifact below is the Notes feature under its database name.

- **Done:**
    - `supabase/migrations/20260614215854_access_model.sql` — access tables, capability helpers, RLS
      rewrite, archive triggers, backfill, `owner` → `created_by`, `board_by_token` and `soft_delete_topic`
      rewrites.
    - `supabase/migrations/20260614215856_content_versioning.sql` — revision tables, `current_revision_id`,
      seed revisions, `commit_board`/`commit_topic`.
    - Documentation (`architecture.md`, `AGENTS.md`, `README.md`).
    - **Client cutover**: `supabase/rows.ts`, `boards/types.ts`, `notes/types.ts`,
      `boards/operations.ts`/`notes/operations.ts` (creation defaults), `boards/useBoards.ts`,
      `notes/useNotes.ts`, `App.tsx`, `admin/useAdmin.ts`, `bundle/parse.ts`, `bundle/ReplaceBoardDialog.tsx`,
      `editor/BoardActionsMenu.tsx`, `sharing/share.ts`, new `sharing/AccessManager.tsx` (replaces and
      deletes `ShareDialog.tsx`/`MoveToMenu.tsx`), and the test suite + Supabase fake.
    - **Edge functions rewritten** (`supabase/functions/`, not deployed): `delete-account` soft-deletes by
      banning and flagging the profile only, leaving the user's grants intact so restore is lossless;
      `restore-account` just un-bans and clears the flag; `purge-expired` hard-deletes the expired auth user
      and lets the cascade + reference-count trigger archive any orphaned content. No function references a
      dropped column.
    - **History/diff UI** (new `src/history/`): `diff.ts` (structured `diffBoard`/`diffNote` + summary),
      `useRevisions.ts` (`useBoardRevisions`/`useNoteRevisions`, newest-first, author names, per-revision
      summary), `RevisionList.tsx`, `BoardHistory.tsx` (revision list beside a read-only `BoardView`
      preview), and `NoteHistory.tsx` (list beside a read-only block preview). Revision row mappers
      (`boardFromRevision`/`noteFromRevision`) live in `supabase/rows.ts`. Wired into `App.tsx` as a
      per-content surface, opened from the board overflow menu and the note actions menu; restore commits the
      old content as a new revision (overwrite for boards, plain commit for notes).
    - **Note co-editing across accounts** (follow-up 1): `Note` gained a derived `capability` (computed in
      `useNotes` from the space's grant and the viewer's role, exactly as boards), so note editing is now gated
      per note (`canEditNote` in `App.tsx`) instead of by the space. Manage-access and delete are owner-only.
      New `sharing/NoteAccessManager.tsx` shares a note's whole subtree at once: a grant is written per node
      (`subtreeIds`), so reads stay non-recursive. Opened from the note page's actions menu for an owner.
    - Green on `npm run typecheck`/`lint`/`build`/`format` and 501 tests (18 under `tests/history/`, plus
      note-capability and subtree-sharing tests).
- **Schema and functions applied to production (2026-06-15).** Both migrations are pushed and the three edge functions (`delete-account`, `restore-account`, `purge-expired`) deployed with `--no-verify-jwt`. The still-deployed client is the old one, so the live site is in the brief breakage window until the client merge (production step 4). Two latent bugs in `20260614215854_access_model.sql` were fixed before it applied (see implementation notes): the scope-partial slug indexes are now dropped before the `scope` column, and `enforce_board_guards` uses `create or replace` because it pre-existed. The first push attempt failed on the slug-index drop and rolled back cleanly (transactional, byte-identical schema after), leaving production untouched; the fixed re-push applied both migrations.
- **Remaining** (two groups, detailed in [Next steps](#next-steps-for-whoever-picks-this-up)):
    1. **Follow-ups** (pre-production): ~~note co-editing across accounts~~ **done**; ~~RLS policy tests under `supabase/tests/`~~ **done** (written, not yet run, since execution belongs to the production step); ~~documentation pass~~ **done**. All pre-production follow-ups are complete; only the production step remains.
    2. **Production** (user-confirmed, last): ~~push the migrations + functions~~ **done (2026-06-15)**; ~~run the RLS test~~ **done (2026-06-16, `ALL RLS TESTS PASSED`)**; remaining: test in dev against the migrated database, merge to deploy the client, then test in live.

## Implementation notes (as built)

### Database (migrations)

- **Capability is encoded as `viewer`/`editor`/`owner`** with `capability_rank` (1/2/3) for comparison. A
  null/absent capability ranks 0, so a missing grant never clears a write check.
- **`board_capability`/`topic_capability`** (security definer, non-recursive) return the caller's highest
  grant: admin → owner; direct user grant → itself; team grant → its capability for a coach, viewer for any
  member; showcase team grant → viewer for everyone.
- **`commit_board`/`commit_topic` return the new revision id, or `null` when the base is stale** (the
  conflict signal the client resolves). They unpack the content jsonb back into the typed columns (the live
  render source), so the columns and the snapshot stay in agreement.
- **Reference counting** lives in `after delete` triggers on the access tables: a content row grace-archives
  only when its last grant is gone, with an existence guard so a hard purge (which cascades grants away)
  never races the delete that fired it.
- **Bootstrap insert policy:** the creator may add the first grant because `boards.created_by = auth.uid()`;
  a team grant additionally requires coaching that team, so a board cannot be dumped into an arbitrary
  team's library.
- **Bundle and the board-creator skill are unchanged**: the bundle already excludes server-owned fields, so
  access and revisions never enter it and `FORMAT_VERSION` does not bump.

### Client (cutover)

- **`Board`/`Note` gained `createdBy`, derived `capability`, and `currentRevisionId`**, dropping
  `owner`/`authorLocked`/`shared`/`teamId`. `capability` is computed in `useBoards` from the space's grant
  and the viewer's role (admin → owner; coach → the grant's capability; otherwise a team grant reads as
  viewer; a personal grant counts as itself).
- **Loads join the access table** by principal (`board_access.team_id`/`user_id`). **Create** inserts the
  row then its first owner grant. **Commit** goes through `commit_board`/`commit_topic`; a `null` return is
  the `COMMIT_CONFLICT` sentinel, which `App.commit` resolves with an overwrite/keep-editing prompt (board
  only; a note conflict surfaces a readable message). **Delete** detaches the caller's grant.
- **`AccessManager`** lists grants, adds a teammate or a team you coach at a chosen capability, changes a
  capability, removes/leaves, and copies the share link. It is self-contained (its own reads/writes through
  RLS) and opens from the board view's overflow menu for an owner. `CopyToMenu`/copy-as-fork is unchanged.
- **Deep-link self-heal**: `fetchBoardById` returns the board's grants, and `App` heals a board URL to a
  team space the viewer can reach, else personal.
- **Tests**: the Supabase fake models the access tables (embedded grants, dotted `<embed>.<col>` filters)
  and the commit RPCs (`setCommitConflict`/`failCommits` exercise the conflict and failure paths).

## Next steps (for whoever picks this up)

**Production goes last.** Applying the migrations rewrites the live schema (renames `owner` → `created_by`,
drops `scope`/`shared`/`author_locked`, adds the access and revision tables). There is one Supabase project
and it *is* production, so any breaking migration unavoidably breaks the currently-deployed client (and the
old Edge Functions) for a window — in either order. The order below minimises and de-risks that window:
finish all the code, push the schema and functions to production, verify the new client locally against the
now-migrated database, and only then merge (which deploys the new client) and verify live. The live site is
briefly broken between the push and the deploy completing — a short CI window.

Do them in this order. Load the **supabase** skill before any DB or Edge Function work, and never `db push`
or `functions deploy` without the user's explicit go-ahead.

1. ~~**Rewrite the three Edge Functions.**~~ **Done** (not deployed). The decided model: account soft-delete
   leaves the user's grants intact (banning + flagging the profile already removes them as an active
   principal), so restore is lossless; only the hard purge drops grants, and the reference-count trigger
   archives whatever that orphans. No function references a dropped column.
2. ~~**History/diff UI** (`src/history/`).~~ **Done.** Revision list with a per-revision change summary, a
   read-only preview through the existing `BoardView`/note-block render, and restore (commits old content as a
   new revision). Opened from the board overflow menu and the note actions menu. Covered by `tests/history/`.
3. **Follow-ups** (code and docs, all pre-production):
    1. ~~**Note co-editing across accounts**~~ **Done.** `Note` carries a derived `capability` (computed in `useNotes` like boards); note edit/subnote/history-restore are gated per note (`canEditNote`), and manage-access and delete are owner-only. `sharing/NoteAccessManager.tsx` shares a note's whole subtree by writing one grant per node, opened from the note actions menu for an owner. Covered by `tests/notes/useNotes.test.ts` (capability derivation) and `tests/sharing/NoteAccessManager.test.tsx` (subtree write).
    2. ~~**RLS policy tests**~~ **Done.** `supabase/tests/rls_policies_test.sql` rewritten for the access model: it builds throwaway users, teams, boards, and grants, then asserts each capability path (team owner/editor/viewer grants, a direct user co-edit grant, personal privacy), the team-role cap, the leave-vs-manage split, the showcase widening (against the existing global showcase team), admin god-mode, the share-token rule, the bootstrap-and-coach insert guard, the archive-on-empty reference-count trigger, and the commit compare-and-swap, then rolls back. **Not yet run** — there is no local Supabase, so executing it against the migrated database belongs to the production step.
    3. ~~**Documentation pass**~~ **Done.** Audited `architecture.md`, `AGENTS.md`, and `README.md` against the shipped access model and history. README was already accurate (co-editing, cross-team grants, history, reference-counted deletion). Fixes: added the `src/history/` module-map entry to AGENTS.md and pluralized the access managers (board + note); trimmed the retired-concept contrast in architecture.md ("author-lock/move are all just grants now, not separate flags"); documented note sharing (per-note capability + the subtree-granting note access manager) in the Sharing subsection; and added `capability`/`currentRevisionId` to the architecture `Note` type for parity with `Board`. A final sweep found no remaining stale phrasing; net length roughly flat.
4. **Production** (user-confirmed; the final, one-way sequence):
    1. ~~**Push the Supabase changes.**~~ **Done (2026-06-15).** Linked the worktree, confirmed a clean `migration list` and a 2-migration `db push --dry-run`, fixed two bugs in the access-model migration (drop the scope-partial slug indexes before the `scope` column; `enforce_board_guards` → `create or replace` since it pre-existed), then `db push` applied both migrations and `functions deploy --no-verify-jwt` shipped delete-account, restore-account, purge-expired. Verified the migrated schema (all new tables, columns, RPCs, policies, triggers, the home-slug index) and the backfill: 10 boards → 10 grants + 10 revisions, 12 topics → 12 grants + 12 revisions. The first push attempt rolled back cleanly and left production untouched.
    2. ~~**Run the RLS test file.**~~ **Done (2026-06-16): `ALL RLS TESTS PASSED`** against the migrated production database in the SQL Editor. Three test-only fixes were needed first (no policy or migration change): the teams fixture now supplies the NOT NULL `slug`; the section-4 "leave" test re-grants coachA2 to the co-edited board so the section-9 user-shared share-token check still has a board shared with a non-creator; and the test must be run from the worktree copy, since the `VolleyCoach` checkout still holds the old pre-access-model version. Every path holds: each capability, the team-role cap, the leave-vs-manage split, showcase widening, admin god-mode, the share-token rule, the bootstrap-and-coach insert guard, the archive-on-empty trigger, and the commit compare-and-swap. The corrected test currently lives only in the worktree's working tree (uncommitted), so re-runs must use that copy until it is committed and merged.
    3. **Test in dev.** Run the local dev server (the new client code) against the now-migrated production
       database: an existing board reads back with the right `capability`, a commit advances the revision,
       history and access management work, and account delete/restore behave. Read-only MCP can spot-check the
       schema (access tables populated, archive-on-empty).
    4. **Merge the PR** (when the user asks), which deploys the new client to Cloudflare.
    5. **Test in live.** Confirm the deployed site against the migrated schema: a board opens, a commit lands,
       history and sharing work, and a share link resolves.

After completing any step here, update the Progress and Implementation-notes sections above so this file
stays the single source of truth for where things stand.
