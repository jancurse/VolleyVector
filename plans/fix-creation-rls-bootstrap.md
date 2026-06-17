# Fix board/note creation for non-admins (RLS bootstrap)

## Implementation Agent Instructions

- **Role**: Full-stack engineer working across Supabase RLS/migrations and the React client.
- **Task**: Let a non-admin user create a board or note again by fixing the access-list bootstrap policy that currently blocks the creator's first grant.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - Access and data-exposure rules are enforced server-side (RLS/RPC), never only in the client.
    - The migration touches the one production database. Follow the `supabase` skill; never push without the user's explicit go-ahead.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @docs/architecture.md (Backend and access control)
    - `supabase/migrations/20260614215854_access_model.sql` (defines the affected policies and the `*_capability` helpers)
    - `src/boards/useBoards.ts` (the two-step create: board row, then the creator's first grant) and the notes store's equivalent create path
    - The `supabase` skill (migration workflow, production safety)
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. If you uncover unplanned work that belongs in its own future project, add it there. Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Problem

A non-admin user cannot create a board or note. The save fails with `new row violates row-level security policy for table "board_access"` (or `topic_access`), leaving a row with no access grant.

Creating content is two writes: insert the `boards`/`topics` row (`created_by = auth.uid()`), then insert the creator's first `*_access` owner grant. The grant insert is gated by `board_access_insert` / `topic_access_insert`, whose bootstrap clause is `(select created_by from <table> where id = <id>) = auth.uid()`. That subquery reads the content table under RLS, and `*_select` only reveals a row where `*_capability(id) is not null` — i.e. one the caller already has a grant on. A brand-new row has no grant yet, and `*_capability` never credits the creator, so the creator cannot see their own just-created row through the subquery: it returns null, the clause fails, and the first grant is rejected. Admins are unaffected because `*_capability` returns owner for them via `is_admin()`.

Introduced by `20260614215854_access_model.sql`. It affects both boards and notes identically.

### Requirements

- A non-admin user can create a board and a note: the row and the creator's first owner grant both persist.
- The fix is a reviewed migration in `supabase/migrations/`, applied to production only with the user's explicit confirmation, verified against the live schema afterward.
- The bootstrap clause reads `created_by` through a `security definer` creator-lookup helper (e.g. `board_creator(uuid)` / `topic_creator(uuid)`) that bypasses RLS, replacing the plain subquery that RLS hides. The helper returns the creator **only while the row still has no access grant**, so it answers solely during the transient bootstrap window and cannot be used to look up the author of an established board or note. This is done without:
    - broadening `boards_select` / `topics_select` to include `created_by` (would expose content a creator has detached from), or
    - changing `board_capability` / `topic_capability` (would alter capability semantics everywhere).
- Every other clause of the insert policies is unchanged: the existing-owner path, the team-grant guard (`team_id is null or is_team_coach(team_id) or is_admin()`), and the admin path.
- Both `board_access_insert` and `topic_access_insert` are fixed in the same change.
- Creating a board or note is atomic: the content row and the creator's first grant either both persist or neither does, so a failed create never leaves a grant-less orphan row. (Recommended: a `security definer` create RPC that writes both in one transaction; alternatively the client removes the row if the grant write fails.)
- The migration ends with `notify pgrst, 'reload schema';` and grants any new function to the roles that need it.

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill for frontend tests. Note that the in-memory Supabase fake does not model RLS, so it cannot exercise the policy itself; do not add a unit test that pretends to. The policy fix is verified against the live database (see Acceptance Criteria), not by the unit suite.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- After the migration is applied: a non-admin account creates a board and a note end-to-end, both with their owner grant; an admin can still create both; sharing and other access-list operations are unchanged.
- The fix does not make a grant-less or detached board/note visible to a non-admin through `*_select`.

## Follow-ups

- **Delete the orphaned grant-less board rows** left by the failed creation attempts: `ZZ Temp Access Test` (`38b4908c-684b-4c40-a4ed-a38492c67fd0`) and `test board` (`02d3597b-a31c-41f5-b92a-ea5f44907e09`). Both have zero `board_access` grants, are invisible in the app, and will not be reference-count archived (there is no grant whose removal triggers it). Remove via an ad-hoc data fix once board creation works, then verify the rows are gone.
- **Build an RLS/migration test harness** so policy regressions are caught automatically (e.g. a local Supabase stack or pgTAP that runs inserts as a non-admin role against real policies). The current unit suite mocks Supabase and cannot exercise RLS, so this whole class of bug is invisible to it.
- **Capture the redesigned "Manage access" screenshots** to verify the sharing UI redesign visually (grant list, the add-a-person picker at full width, the outside-teams block, the view-only-link footer), now that a non-admin (Dev Coach) can own a board to open the dialog on.

## Implementation Notes

One migration (`supabase/migrations/20260616221448_fix_creation_access_bootstrap.sql`) plus a small client change in both stores. Applied to production with the user's go-ahead and verified against the live schema.

### The bootstrap fix

- Added `board_creator(uuid)` / `topic_creator(uuid)`: `security definer`, `stable`, `set search_path = ''`, granted to `authenticated`. Each returns `created_by` only while the row still has no access grant (`not exists (... access ...)`), so it answers solely during the transient bootstrap window. Verified live that it returns `null` for an established board (one with grants), so it cannot look up the author of detached or established content.
- Re-created `board_access_insert` / `topic_access_insert` (drop + create) with the bootstrap clause reading `... or public.board_creator(board_id) = auth.uid()` in place of the RLS-hidden subquery. Every other clause is byte-for-byte unchanged: the existing-owner path (`capability_rank(...) >= 3`) and the team-grant guard (`team_id is null or is_team_coach(team_id) or is_admin()`). Confirmed against the live `pg_policy` definitions.
- `boards_select` / `topics_select`, `board_capability` / `topic_capability`, and the other access-list policies are untouched, so read visibility and capability semantics are unchanged everywhere.

### Atomicity

- The two-step client create stays (board/note row, then the creator's first grant), so every access guard remains in RLS rather than being re-implemented in a definer function. This is why I did **not** use a `security definer` create RPC: such an RPC bypasses RLS and would force the team-grant guard to be duplicated inside it (a more security-sensitive surface where a bug could push a board into an arbitrary team).
- For atomicity I took the plan's "client removes the row" alternative. The literal form (`supabase.from("boards").delete()`) cannot work — board/note deletes are admin-only under RLS — so the removal goes through narrow `delete_orphan_board(uuid)` / `delete_orphan_topic(uuid)` `security definer` helpers, each scoped to delete only a grant-less row the caller created. An established row always carries at least its creator's grant, so these can never remove live content.
- This is best-effort compensation, not transactional atomicity: a tiny window remains if both the grant write and the cleanup call fail (e.g. total network loss), leaving an orphan an admin can still recover. That is strictly better than before (the grant write used to fail every time, orphaning every create) and matches the existing admin path, which has the same residual window. If you want the stronger "both-or-neither in one transaction" guarantee instead, say so and I'll move create behind a definer RPC (and re-add the team guard inside it).

### Client and tests

- `src/boards/useBoards.ts` (`addBoard`) and `src/notes/useNotes.ts` (`insertNote`): on a failed grant write, call the matching `delete_orphan_*` RPC before returning the error. The editor still shows the error and keeps the draft.
- `tests/helpers/supabaseFake.ts`: `failWrites` gained an optional `table` argument (fail only that table's writes), and the two cleanup RPCs are accepted as no-ops. Added a `useBoards` test that a failed `board_access` write removes the orphan via `delete_orphan_board` and reports the error.
- The in-memory fake does not model RLS, so the policy itself is not unit-tested (per the plan); it is verified against the live database. All 509 tests pass; format, lint, and typecheck are clean.

### Critical Issues

_None._
